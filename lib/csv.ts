// 定型 CSV の検証と差分計算。エラーが 1 件でもあれば申請不可（部分取込なし）。

import Papa from "papaparse";
import { DATASETS, getDataset, referencedBy, type Dataset, type DatasetId } from "./datasets";
import type { Row } from "./db";

export type ImportMode = "upsert" | "replace" | "delete";
export const MODE_LABEL: Record<string, string> = {
  initial: "初期登録",
  upsert: "差分更新（追加・変更のみ。CSV にない行は残す）",
  replace: "全件置換（CSV にない行は削除）",
  delete: "削除指定（CSV の行を削除）",
  restore: "旧版への復元",
};

export type CsvError = { line: number | null; column?: string; message: string };
export type FieldChange = { column: string; before: string | null; after: string | null };
export type DiffItem =
  | { op: "add"; key: string; row: Row }
  | { op: "change"; key: string; changes: FieldChange[] }
  | { op: "delete"; key: string; row: Row };

export type ValidationResult = {
  ok: boolean;
  errors: CsvError[];
  warnings: string[];
  rowCount: number;
  diff: DiffItem[];
  summary: { added: number; changed: number; deleted: number; unchanged: number; total: number };
  snapshot: Row[];
};

/** DB 値・CSV 値を比較可能な文字列に揃える（空は null） */
export function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? "true" : "false";
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function normalizeRow(ds: Dataset, r: Row): Row {
  const out: Row = {};
  for (const c of ds.columns) {
    let v = toStr(r[c.name]);
    if (v !== null && c.type === "bool") v = ["true", "1", "yes", "はい", "可", "TRUE", "t"].includes(v) ? "true" : "false";
    if (v !== null && (c.type === "int" || c.type === "num") && !Number.isNaN(Number(v))) v = String(Number(v));
    out[c.name] = v;
  }
  return out;
}

function checkValue(ds: Dataset, r: Row, line: number, errors: CsvError[]) {
  for (const c of ds.columns) {
    const v = toStr(r[c.name]);
    if (v === null) {
      if (c.required) errors.push({ line, column: c.name, message: `必須項目「${c.label}」が空です` });
      continue;
    }
    if (c.enum && !c.enum.includes(v))
      errors.push({ line, column: c.name, message: `「${c.label}」の値「${v}」は不正です（${c.enum.join(" / ")}）` });
    if (c.type === "int" && !/^-?\d+$/.test(v)) errors.push({ line, column: c.name, message: `「${c.label}」は整数で入力してください（${v}）` });
    if (c.type === "num" && Number.isNaN(Number(v))) errors.push({ line, column: c.name, message: `「${c.label}」は数値で入力してください（${v}）` });
    if (c.type === "bool" && !["true", "false", "1", "0", "TRUE", "FALSE", "はい", "いいえ", "可", "不可", "t", "f", "yes", "no"].includes(v))
      errors.push({ line, column: c.name, message: `「${c.label}」は true / false で入力してください（${v}）` });
    if (c.type === "ym" && !/^\d{4}(-(0[1-9]|1[0-2]))?$/.test(v))
      errors.push({ line, column: c.name, message: `「${c.label}」は YYYY-MM または YYYY（年のみ）で入力してください（${v}）。月の推測はしません` });
  }
  if (ds.id === "vehicles") {
    const from = toStr(r.period_from);
    const to = toStr(r.period_to);
    // 年のみと年月が混在する場合は共通する桁で比較する
    if (from && to && from.slice(0, Math.min(from.length, to.length)) > to.slice(0, Math.min(from.length, to.length)))
      errors.push({ line, column: "period_from", message: `期間の開始（${from}）が終了（${to}）より後になっています` });
  }
  if (ds.id === "vehicle_batteries" && /^-?\d+$/.test(toStr(r.qty) ?? "") && Number(r.qty) < 1)
    errors.push({ line, column: "qty", message: `「個数」は 1 以上で入力してください（${r.qty}）` });
  if (ds.id === "own_mappings") {
    if (r.match_type === "spec" && (!toStr(r.category) || !toStr(r.spec_code)))
      errors.push({ line, message: "対応元が spec の場合、規格区分と規格表記は必須です" });
    if (r.match_type === "product" && !toStr(r.product_id))
      errors.push({ line, message: "対応元が product の場合、他社商品ID は必須です" });
    if (r.status === "自社対応確認済み" && (!toStr(r.approved_by) || !toStr(r.approved_at)))
      errors.push({ line, message: "「自社対応確認済み」には承認者・承認日が必要です（開発側の推測で承認状態にしない）" });
  }
}

export function parseCsv(text: string) {
  const res = Papa.parse<Row>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", delimiter: "," });
  return { rows: res.data, headers: res.meta.fields ?? [], parseErrors: res.errors };
}

/** ヘッダーが完全に一致するデータセットを返す（対象マスターの選択ミス防止） */
export function detectDataset(headers: string[]) {
  const set = new Set(headers);
  return DATASETS.find((d) => d.columns.length === set.size && d.columns.every((c) => set.has(c.name)));
}

/** ファイルの内容から対象マスターを判定する（1 行目のみ解析） */
export function detectDatasetFromText(text: string) {
  return detectDataset(parseCsv(text.split(/\r?\n/, 1)[0] ?? "").headers);
}

/**
 * live: 各データセットの公開中データ（参照整合チェックに使う）
 */
export function validateImport(
  dsId: DatasetId,
  mode: ImportMode,
  text: string,
  live: Record<DatasetId, Row[]>,
): ValidationResult {
  const ds = getDataset(dsId)!;
  const { rows, headers, parseErrors } = parseCsv(text);
  const errors: CsvError[] = parseErrors.map((e) => ({ line: e.row != null ? e.row + 2 : null, message: `CSV 形式エラー: ${e.message}` }));
  const warnings: string[] = [];

  const colNames = ds.columns.map((c) => c.name);
  const needCols = mode === "delete" ? [ds.key] : ds.columns.filter((c) => c.required).map((c) => c.name);
  const other = detectDataset(headers);
  const wrongTarget = !!other && other.id !== dsId;
  // 別のマスター用の CSV は、列ごとのエラーを並べず原因だけを示す
  if (wrongTarget) errors.push({ line: 1, message: `この CSV は「${other.label}」用です。対象マスターを「${other.label}」に変更してください` });
  else {
    for (const n of needCols) if (!headers.includes(n)) errors.push({ line: 1, column: n, message: `必須列「${n}」がヘッダーにありません` });
    for (const h of headers) if (!colNames.includes(h)) errors.push({ line: 1, column: h, message: `未定義の列「${h}」があります（定型 CSV 以外は取り込めません）` });
  }
  if (mode !== "delete" && !wrongTarget) {
    const missingOptional = colNames.filter((c) => !headers.includes(c) && !needCols.includes(c));
    if (missingOptional.length)
      errors.push({ line: 1, message: `列が不足しています: ${missingOptional.join(", ")}（空欄で良い列もヘッダーは必要です。差分更新で値が消えるのを防ぐため）` });
  }
  if (rows.length === 0) errors.push({ line: null, message: "データ行がありません" });

  const fatalHeader = errors.length > 0;
  const seen = new Map<string, number>();
  if (!fatalHeader) {
    rows.forEach((r, i) => {
      const line = i + 2;
      const key = toStr(r[ds.key]);
      if (!key) errors.push({ line, column: ds.key, message: "キー列が空です" });
      else if (seen.has(key)) errors.push({ line, column: ds.key, message: `キー「${key}」が ${seen.get(key)} 行目と重複しています` });
      else seen.set(key, line);
      if (mode !== "delete") checkValue(ds, r, line, errors);
    });
  }

  // 反映後の全件を組み立てる
  const liveRows = (live[dsId] ?? []).map((r) => normalizeRow(ds, r));
  const liveMap = new Map(liveRows.map((r) => [r[ds.key] as string, r]));
  const next = new Map(mode === "replace" ? [] : liveMap);
  if (!fatalHeader) {
    rows.forEach((r, i) => {
      const key = toStr(r[ds.key]);
      if (!key) return;
      if (mode === "delete") {
        if (!liveMap.has(key)) errors.push({ line: i + 2, column: ds.key, message: `削除対象「${key}」は登録されていません` });
        next.delete(key);
      } else next.set(key, normalizeRow(ds, r));
    });
  }
  const snapshot = [...next.values()].sort((a, b) => String(a[ds.key]).localeCompare(String(b[ds.key])));

  // 参照整合：この CSV が参照する先
  const lineOf = (key: string) => seen.get(key) ?? null;
  if (!fatalHeader && mode !== "delete") {
    for (const c of ds.columns.filter((c) => c.ref)) {
      const target = getDataset(c.ref!)!;
      const keys = new Set((c.ref === dsId ? snapshot : live[c.ref!] ?? []).map((r) => String(r[target.key])));
      for (const r of rows) {
        const v = toStr(r[c.name]);
        if (v && !keys.has(v))
          errors.push({ line: lineOf(String(r[ds.key])), column: c.name, message: `参照先「${target.label}」に「${v}」が存在しません` });
      }
    }
  }
  // 参照整合：削除される行が他から参照されていないか
  const removed = [...liveMap.keys()].filter((k) => !next.has(k));
  if (removed.length) {
    const rm = new Set(removed);
    for (const ref of referencedBy(dsId)) {
      const using = (live[ref.dataset] ?? []).filter((r) => rm.has(String(r[ref.column])));
      for (const u of using.slice(0, 20)) {
        const refDs = getDataset(ref.dataset)!;
        errors.push({
          line: lineOf(String(u[ref.column])),
          message: `「${u[ref.column]}」は ${refDs.label}（${u[refDs.key]}）から参照されているため削除できません`,
        });
      }
    }
    if (mode === "replace") warnings.push(`全件置換により ${removed.length} 件が削除されます`);
  }

  const diff: DiffItem[] = [];
  let unchanged = 0;
  for (const [key, row] of next) {
    const before = liveMap.get(key);
    if (!before) diff.push({ op: "add", key, row });
    else {
      const changes = ds.columns
        .filter((c) => toStr(before[c.name]) !== toStr(row[c.name]))
        .map((c) => ({ column: c.name, before: toStr(before[c.name]), after: toStr(row[c.name]) }));
      if (changes.length) diff.push({ op: "change", key, changes });
      else unchanged++;
    }
  }
  for (const key of removed) diff.push({ op: "delete", key, row: liveMap.get(key)! });

  const summary = {
    added: diff.filter((d) => d.op === "add").length,
    changed: diff.filter((d) => d.op === "change").length,
    deleted: removed.length,
    unchanged,
    total: snapshot.length,
  };
  if (!errors.length && summary.added + summary.changed + summary.deleted === 0) warnings.push("変更点がありません");
  return { ok: errors.length === 0, errors, warnings, rowCount: rows.length, diff, summary, snapshot };
}

export function toCsv(dsId: DatasetId, rows: Row[]) {
  const ds = getDataset(dsId)!;
  return "﻿" + Papa.unparse({ fields: ds.columns.map((c) => c.name), data: rows.map((r) => ds.columns.map((c) => toStr(r[c.name]) ?? "")) });
}

export { DATASETS };
