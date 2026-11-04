// DB アクセス。判定ロジックは judge.ts、CSV 検証は csv.ts に分離。

import { db, type Row } from "./db";
import { DATASETS, getDataset, type DatasetId } from "./datasets";
import { toCsv, validateImport, type ImportMode, type ValidationResult } from "./csv";
import type { JudgeResult, MasterData } from "./judge";

export type Actor = { name: string; role: "staff" | "approver" | "viewer" };

const order = (id: DatasetId) => getDataset(id)!.key;

export async function loadDataset(id: DatasetId) {
  return db().query(`SELECT * FROM ${id} ORDER BY ${order(id)}`);
}

export async function loadAllLive() {
  const entries = await Promise.all(DATASETS.map(async (d) => [d.id, await loadDataset(d.id)] as const));
  return Object.fromEntries(entries) as Record<DatasetId, Row[]>;
}

export async function loadMaster(): Promise<MasterData> {
  const all = await loadAllLive();
  return {
    vehicles: all.vehicles,
    batteries: all.vehicle_batteries,
    mappings: all.own_mappings,
    sources: all.sources,
    ownProducts: all.own_products,
    products: all.products,
  };
}

/** 各データセットの公開中の版番号 */
export async function publishedVersions(): Promise<Record<string, number>> {
  const rows = await db().query<{ dataset: string; version_no: number }>(
    `SELECT dataset, version_no FROM master_versions WHERE status = 'published'`,
  );
  return Object.fromEntries(rows.map((r) => [r.dataset, r.version_no]));
}

export async function logAnswer(channel: string, r: JudgeResult, actor?: string) {
  const versions = await publishedVersions();
  const parts = r.answer?.parts.map((p) => p.part_no).join(", ") ?? null;
  await db().query(
    `INSERT INTO answer_logs (channel, kind, query, result_state, own_parts, reasons, master_versions, actor)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7::jsonb, $8)`,
    [channel, r.kind, JSON.stringify(r.trace.input), r.state, parts, JSON.stringify([...r.reasons, ...r.missing.map((m) => `不足: ${m}`)]), JSON.stringify(versions), actor ?? null],
  );
  return versions;
}

// ---------------- 版管理 ----------------

export async function listVersions(dataset?: string) {
  return db().query(
    `SELECT id, dataset, version_no, status, mode, file_name, base_version, restored_from, summary,
            submitted_by, submitted_at, reviewed_by, reviewed_at, review_note
       FROM master_versions ${dataset ? "WHERE dataset = $1" : ""}
      ORDER BY submitted_at DESC, id DESC`,
    dataset ? [dataset] : [],
  );
}

/** 各データセットの公開中の版（件数・承認日時つき） */
export async function publishedDetails() {
  return db().query(
    `SELECT id, dataset, version_no, mode, reviewed_by, reviewed_at, submitted_by, jsonb_array_length(snapshot) AS row_count
       FROM master_versions WHERE status = 'published' ORDER BY dataset`,
  );
}

export async function getVersion(id: number) {
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) return undefined;
  const rows = await db().query(`SELECT * FROM master_versions WHERE id = $1`, [id]);
  return rows[0];
}

export async function validate(dataset: DatasetId, mode: ImportMode, csv: string) {
  return validateImport(dataset, mode, csv, await loadAllLive());
}

async function createPending(
  dataset: DatasetId,
  mode: string,
  v: ValidationResult,
  actor: Actor,
  extra: { file_name?: string; restored_from?: number },
) {
  const cur = (await publishedVersions())[dataset] ?? 0;
  // 同時申請で版番号が衝突した場合は採番し直す
  for (let attempt = 1; ; attempt++) {
    try {
      const rows = await db().query(
        `INSERT INTO master_versions (dataset, version_no, status, mode, file_name, base_version, restored_from, summary, diff, snapshot, submitted_by)
         SELECT $1::text, coalesce(max(version_no), 0) + 1, 'pending', $2::text, $3::text, $4::int, $5::int, $6::jsonb, $7::jsonb, $8::jsonb, $9::text FROM master_versions WHERE dataset = $1::text
         RETURNING id, version_no`,
        [dataset, mode, extra.file_name ?? null, cur, extra.restored_from ?? null, JSON.stringify(v.summary), JSON.stringify(v.diff), JSON.stringify(v.snapshot), actor.name],
      );
      return rows[0];
    } catch (e) {
      if (attempt >= 5 || !String((e as Error)?.message).includes("duplicate key")) throw e;
    }
  }
}

export async function submitImport(dataset: DatasetId, mode: ImportMode, csv: string, fileName: string, actor: Actor, allowDelete = false) {
  if (actor.role === "viewer") throw new Error("閲覧者は申請できません");
  const v = await validate(dataset, mode, csv);
  if (!v.ok) return { ok: false as const, validation: v };
  if (v.summary.added + v.summary.changed + v.summary.deleted === 0) return { ok: false as const, validation: v };
  // 削除は明示的に許可された場合のみ
  if (v.summary.deleted > 0 && !allowDelete) throw new Error(`${v.summary.deleted} 件の削除を含みます。削除を許可する指定がないため申請できません`);
  const created = await createPending(dataset, mode, v, actor, { file_name: fileName });
  return { ok: true as const, validation: v, version: created };
}

/** 旧版に戻した場合の影響（現在の公開データとの差分）を事前に確認する */
export async function previewRestore(id: number) {
  const old = await getVersion(id);
  if (!old) throw new Error("版が見つかりません");
  const v = await validate(old.dataset, "replace", toCsv(old.dataset, old.snapshot));
  const current = (await publishedVersions())[old.dataset];
  return { dataset: old.dataset, version_no: old.version_no, current, ok: v.ok, errors: v.errors, summary: v.summary, diff: v.diff };
}

export async function requestRestore(id: number, actor: Actor) {
  if (actor.role !== "approver") throw new Error("旧版への復元は承認者のみ操作できます");
  const old = await getVersion(id);
  if (!old) throw new Error("版が見つかりません");
  if (old.status === "pending" || old.status === "rejected") throw new Error("公開されたことのある版のみ復元できます");
  const v = await validate(old.dataset, "replace", toCsv(old.dataset, old.snapshot));
  if (!v.ok) return { ok: false as const, validation: v };
  if (v.summary.added + v.summary.changed + v.summary.deleted === 0) throw new Error("現在の公開データと同じ内容のため、復元の必要はありません");
  const created = await createPending(old.dataset, "restore", v, actor, { restored_from: old.version_no });
  return { ok: true as const, validation: v, version: created };
}

export async function approve(id: number, actor: Actor, note?: string) {
  if (actor.role !== "approver") throw new Error("承認権限がありません");
  const v = await getVersion(id);
  if (!v || v.status !== "pending") throw new Error("承認待ちの版ではありません");
  if (v.submitted_by === actor.name) throw new Error("申請者本人は承認できません（ダブルチェック）");
  const cur = (await publishedVersions())[v.dataset] ?? 0;
  if (cur !== v.base_version)
    throw new Error(`申請後に別の版（v${cur}）が公開されています。最新データで再度検証・申請してください`);
  // 反映前に参照整合を再検証
  const recheck = await validate(v.dataset, "replace", toCsv(v.dataset, v.snapshot));
  if (!recheck.ok) throw new Error(`参照整合エラーのため反映できません: ${recheck.errors[0]?.message}`);

  const table = v.dataset as DatasetId;
  // 同時承認に備え、データセット単位でロックし、トランザクション内で再確認する（条件を満たさなければゼロ除算で中止）
  await db().transaction([
    { text: `SELECT pg_advisory_xact_lock(hashtext($1))`, params: [table] },
    {
      text: `SELECT 1 / count(*) FROM master_versions v
              WHERE v.id = $1 AND v.status = 'pending'
                AND v.base_version = coalesce((SELECT max(p.version_no) FROM master_versions p WHERE p.dataset = v.dataset AND p.status = 'published'), 0)`,
      params: [id],
    },
    { text: `DELETE FROM ${table}` },
    { text: `INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table}, $1::jsonb)`, params: [JSON.stringify(v.snapshot)] },
    { text: `UPDATE master_versions SET status = 'superseded' WHERE dataset = $1 AND status = 'published'`, params: [table] },
    {
      text: `UPDATE master_versions SET status = 'published', reviewed_by = $2, reviewed_at = now(), review_note = $3 WHERE id = $1`,
      params: [id, actor.name, note ?? null],
    },
  ]).catch((e) => {
    if (String(e?.message).includes("division by zero")) throw new Error("他の操作が先に反映されました。最新の状態を確認し、必要であれば再度申請してください");
    throw e;
  });
}

export async function reject(id: number, actor: Actor, note?: string) {
  if (actor.role !== "approver") throw new Error("承認権限がありません");
  const v = await getVersion(id);
  if (!v || v.status !== "pending") throw new Error("承認待ちの版ではありません");
  await db().query(
    `UPDATE master_versions SET status = 'rejected', reviewed_by = $2, reviewed_at = now(), review_note = $3 WHERE id = $1`,
    [id, actor.name, note ?? null],
  );
}

// ---------------- 設定 ----------------

export const DEFAULT_BACKUP = { frequency: "毎日 3:00", retention_days: 30, destination: "DBJ 名義のクラウドストレージ", notify: true };

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const rows = await db().query<{ value: T }>(`SELECT value FROM app_settings WHERE key = $1`, [key]);
  return rows[0]?.value ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db().query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)],
  );
}
