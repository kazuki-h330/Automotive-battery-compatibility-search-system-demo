// DBJ 既存形式（1 行 = 1 バッテリー要件の横長 CSV）を、本システムの定型 CSV に変換する。
// 画面の取込と scripts/convert-flat.mjs で共通利用する。推測で埋めた値・判定に影響する不備は結果に残す（自動で直さない）。
//
// 対応形式
//   旧形式（11 列）: サンプル検証用。車名・承認者などの列がないため仮の値を入れる
//   19 列形式     : 本番用。car_name / spec_note / battery_position / quantity / approved_by / approved_at /
//                   type_specification_no / classification_no を使う
//
// 実車確認記録（実車 1 台に限る承認）は汎用の適合マスターに入れず、vehicle_cases に分けて登録する。
// 型式検索では参考表示のみで、自動回答には使わない。
import Papa from "papaparse";
import { CATEGORIES, getDataset, type DatasetId } from "./datasets.ts";
import { parseSpec } from "./normalize.ts";

export const FLAT_COLUMNS = ["id", "vehicle_maker", "model_code", "model_year", "engine_code", "battery_type_spec", "required_battery_code", "dbj_product_code", "status", "Source_note", "customer_reply_allowed"];
/** 19 列形式で追加された列 */
export const FLAT19_COLUMNS = ["car_name", "spec_note", "battery_position", "quantity", "approved_by", "approved_at", "type_specification_no", "classification_no"];
/** 任意列：明示する場合は「汎用」または「実車確認」 */
export const SCOPE_COLUMN = "record_scope";

/** 取込順（参照先が先） */
export const FLAT_ORDER: DatasetId[] = ["sources", "own_products", "vehicles", "vehicle_batteries", "own_mappings", "vehicle_cases"];

export type FlatResult = {
  ok: boolean;
  format: "legacy" | "19";
  rowCount: number;
  errors: string[];
  warnings: string[];
  notes: string[];
  csv: Partial<Record<DatasetId, string>>;
  counts: Partial<Record<DatasetId, number>>;
};

type Rec = Record<string, any>;

const STATUS: Record<string, string> = { 確認済み: "適合確認済み", 条件不足: "解析済み", 未登録: "収集済み" };
const STATUS_RANK = ["収集済み", "解析済み", "適合確認済み"];
const ROLE: Record<string, string> = { 主機: "主機", 補機: "補機", メイン: "主機", サブ: "補機" };
const TRUE_RE = /^(true|1|yes|はい|可)$/i;
const FALSE_RE = /^(false|0|no|いいえ|不可)?$/i;
const pad = (id: unknown) => String(id).padStart(3, "0");
const clean = (text: string) => text.replace(/^﻿/, "");
const str = (v: unknown) => String(v ?? "").trim();

// 「実車 1 台に限る」記録の判定。管理ID または汎用利用を禁じる記載があれば実車確認記録として扱う
const CASE_ID_RE = /DBJ-CASE-[A-Z0-9][A-Z0-9-]*[A-Z0-9]/;
const CASE_TEXT_RE = /1\s*台(に)?限|1\s*台限定|汎用適合マスターへの取込は禁止|型式検索だけの自動回答|同型式.{0,10}(拡張しない|拡張禁止)/;

/** 安定した ID 用の短いハッシュ（分割取込でも同じ車両は同じ ID になる） */
function hash(s: string) {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
    b ^= b >>> 13;
  }
  return a.toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

/** DIN / EN の規格表記：原表記を正規化（全角→半角・大文字・空白の統一）して保持する。LN 等への読み替えはしない */
function normCode(s: string) {
  return s.normalize("NFKC").toUpperCase().replace(/\s+/g, " ").trim();
}

/** DBJ 既存形式の CSV か（1 行目の列で判定） */
export function isFlatCsv(text: string) {
  const headers = clean(text).split(/\r?\n/, 1)[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return FLAT_COLUMNS.every((c) => headers.includes(c));
}

export function convertFlat(text: string, opts: { basis?: string; today?: string } = {}): FlatResult {
  const BASIS = opts.basis ?? "初度登録";
  const TODAY = opts.today ?? new Date().toISOString().slice(0, 10);
  const { data: rows, meta, errors: parseErrors } = Papa.parse<Rec>(clean(text), { header: true, skipEmptyLines: "greedy", delimiter: "," });
  const fields = (meta.fields ?? []).map((f) => f.trim());

  const errors = parseErrors.map((e) => `CSV 形式エラー（${e.row != null ? e.row + 2 : "?"} 行目）: ${e.message}`);
  const warnings: string[] = [];
  const notes: string[] = [];
  const has19 = FLAT19_COLUMNS.filter((c) => fields.includes(c));
  const format: FlatResult["format"] = has19.length ? "19" : "legacy";
  const empty = { ok: false, format, rowCount: rows.length, warnings, notes, csv: {}, counts: {} };

  const absent = FLAT_COLUMNS.filter((c) => !fields.includes(c));
  if (absent.length) return { ...empty, errors: [`必須列がありません: ${absent.join(", ")}`] };
  if (format === "19" && has19.length < FLAT19_COLUMNS.length)
    return { ...empty, errors: [`19 列形式の列が不足しています: ${FLAT19_COLUMNS.filter((c) => !fields.includes(c)).join(", ")}`] };
  const known = new Set([...FLAT_COLUMNS, ...FLAT19_COLUMNS, SCOPE_COLUMN, "reply_template"]);
  const unknown = fields.filter((f) => !known.has(f));
  if (unknown.length) warnings.push(`未定義の列は取り込みません: ${unknown.join(", ")}`);

  const singleMonth: unknown[] = [];
  const at = (r: Rec) => `ID ${str(r.id) || "?"}（${str(r.vehicle_maker)} ${str(r.model_code)}）`;

  /** 年式表記 → 期間。単月表記は「その月のみ」として扱い、範囲を推測しない */
  function period(raw: unknown, r: Rec): { from: string | null; to: string | null } {
    const s = str(raw).normalize("NFKC").replace(/[～〜~]/g, "-").replace(/\s+/g, "");
    if (!s) return { from: null, to: null };
    const ym = (x: string) => x.replace("/", "-");
    let m = s.match(/^(\d{4}\/(?:0[1-9]|1[0-2]))-(\d{4}\/(?:0[1-9]|1[0-2]))$/);
    if (m) {
      if (m[1] > m[2]) errors.push(`${at(r)}: 年式「${s}」の開始が終了より後です`);
      return { from: ym(m[1]), to: ym(m[2]) };
    }
    m = s.match(/^(\d{4}\/(?:0[1-9]|1[0-2]))-$/);
    if (m) return { from: ym(m[1]), to: null };
    m = s.match(/^(\d{4}\/(?:0[1-9]|1[0-2]))$/);
    if (m) {
      singleMonth.push(r.id);
      return { from: ym(m[1]), to: ym(m[1]) };
    }
    m = s.match(/^(\d{4})$/);
    if (m) {
      warnings.push(`${at(r)}: 年式「${s}」は年のみのため、月の比較はできません（確認要として扱われます）`);
      return { from: m[1], to: null };
    }
    errors.push(`${at(r)}: 年式「${s}」を解釈できません（例: 2015/04-2017/12、継続中は 2015/04-）`);
    return { from: null, to: null };
  }

  /** 型式指定番号（5 桁）・類別区分番号（4 桁）。Excel で先頭の 0 が消えた場合は桁数をそろえる */
  function regNo(raw: unknown, digits: number, label: string, r: Rec) {
    const s = str(raw).normalize("NFKC");
    if (!s) return null;
    if (!/^\d+$/.test(s)) {
      errors.push(`${at(r)}: ${label}「${s}」は数字で入力してください`);
      return s;
    }
    if (s.length > digits) errors.push(`${at(r)}: ${label}「${s}」は ${digits} 桁以内です`);
    if (s.length < digits) warnings.push(`${at(r)}: ${label}「${s}」を「${s.padStart(digits, "0")}」として登録しました（Excel で先頭の 0 が消えた可能性）`);
    return s.padStart(digits, "0");
  }

  function approvalDate(raw: unknown, r: Rec) {
    const s = str(raw).normalize("NFKC");
    if (!s) return null;
    const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (!m) {
      errors.push(`${at(r)}: approved_at「${s}」は日付（例: 2026-11-07）で入力してください`);
      return s;
    }
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  // 出典（旧形式はサンプル用の ID を維持）
  const SRC_OK = format === "19" ? "SRC-DBJ-OK" : "SRC-S-OK";
  const SRC_NG = format === "19" ? "SRC-DBJ-NG" : "SRC-S-NG";
  const srcName = format === "19" ? "DBJ 適合データ" : "DBJ 提供サンプル";
  const sources = [
    { id: SRC_OK, name: `${srcName}（顧客回答可）`, kind: "DBJ確認", usage_condition: "顧客回答に利用可", internal_only: false, customer_use: true, note: "customer_reply_allowed = TRUE の行" },
    { id: SRC_NG, name: `${srcName}（顧客回答不可）`, kind: "DBJ確認", usage_condition: "社内確認用。顧客回答不可", internal_only: true, customer_use: false, note: "customer_reply_allowed = FALSE の行" },
  ];

  const vehicles = new Map<string, Rec>();
  const batteries: Rec[] = [];
  const cases: Rec[] = [];
  const own = new Map<string, Rec>();
  const maps = new Map<string, Rec>();
  const seenIds = new Set<string>();
  const vehicleRows = new Map<string, Rec[]>();

  for (const r of rows) {
    const rid = str(r.id);
    for (const c of ["id", "vehicle_maker", "model_code"]) if (!str(r[c])) errors.push(`${at(r)}: ${c} が空です`);
    if (rid) {
      if (seenIds.has(rid)) errors.push(`${at(r)}: id が重複しています`);
      seenIds.add(rid);
    }
    const statusIn = str(r.status);
    const status = STATUS[statusIn];
    if (!status) errors.push(`${at(r)}: status「${r.status ?? ""}」は未定義です（確認済み / 条件不足 / 未登録）`);
    const replyRaw = str(r.customer_reply_allowed);
    if (!TRUE_RE.test(replyRaw) && !FALSE_RE.test(replyRaw)) errors.push(`${at(r)}: customer_reply_allowed「${replyRaw}」は TRUE / FALSE で入力してください`);
    const reply = TRUE_RE.test(replyRaw);
    const code = str(r.dbj_product_code);
    const specNote = format === "19" ? str(r.spec_note) : "";
    const carName = (format === "19" ? str(r.car_name) : "") || str(r.vehicle_maker);
    const approvedBy = format === "19" ? str(r.approved_by) : "";
    const approvedAt = format === "19" ? approvalDate(r.approved_at, r) : null;
    const typeNo = format === "19" ? regNo(r.type_specification_no, 5, "型式指定番号", r) : null;
    const classNo = format === "19" ? regNo(r.classification_no, 4, "類別区分番号", r) : null;
    const roleIn = format === "19" ? str(r.battery_position) : "";
    const role = roleIn ? ROLE[roleIn] : "主機";
    if (roleIn && !role) errors.push(`${at(r)}: battery_position「${roleIn}」は「主機」または「補機」で入力してください`);
    const qtyIn = format === "19" ? str(r.quantity).normalize("NFKC") : "";
    const qty = qtyIn ? Number(qtyIn) : 1;
    if (qtyIn && !(Number.isInteger(qty) && qty >= 1)) errors.push(`${at(r)}: quantity「${qtyIn}」は 1 以上の整数で入力してください`);
    if (code && str(r.reply_template) && !str(r.reply_template).includes(code))
      errors.push(`${at(r)}: reply_template の品番が dbj_product_code「${code}」と一致しません`);

    // 実車確認記録かどうか
    const scopeIn = str(r[SCOPE_COLUMN]);
    const text = `${specNote} ${str(r.Source_note)}`;
    const caseId = text.normalize("NFKC").match(CASE_ID_RE)?.[0];
    const caseText = !!caseId || CASE_TEXT_RE.test(text.normalize("NFKC"));
    let isCase = caseText;
    if (scopeIn) {
      if (/^(実車確認|個別|case)$/i.test(scopeIn)) isCase = true;
      else if (/^(汎用|general)$/i.test(scopeIn)) {
        if (caseText) errors.push(`${at(r)}: record_scope は「汎用」ですが、備考に実車 1 台限定・汎用取込禁止の記載があります。どちらかに修正してください`);
        isCase = false;
      } else errors.push(`${at(r)}: record_scope「${scopeIn}」は「汎用」または「実車確認」で入力してください`);
    }

    // カテゴリ・規格（実車確認記録では空欄可）
    const catIn = str(r.battery_type_spec).normalize("NFKC").toUpperCase().replace(/\s+/g, " ");
    const category = (CATEGORIES as readonly string[]).includes(catIn) ? catIn : undefined;
    const rawSpec = str(r.required_battery_code);
    let specCode: string | undefined;
    if (catIn && !category) errors.push(`${at(r)}: battery_type_spec「${r.battery_type_spec}」は未定義です（${CATEGORIES.join(" / ")}）`);
    if (rawSpec) {
      if (category && /^(DIN|EN)/.test(category)) specCode = normCode(rawSpec);
      else {
        const spec = parseSpec(rawSpec);
        if (!spec) errors.push(`${at(r)}: 規格「${rawSpec}」を解析できません（DIN / EN 規格は battery_type_spec に DIN または EN を指定）`);
        else {
          specCode = spec.spec_code;
          if (category) {
            if (spec.kind === "ISS" && category !== "JIS EFB") warnings.push(`${at(r)}: ${spec.spec_code} はアイドリングストップ車用規格ですが、区分が「${category}」です`);
            else if (spec.kind === "LN" && !category.startsWith("LN")) warnings.push(`${at(r)}: ${spec.spec_code} は LN 規格ですが、区分が「${category}」です`);
            else if (spec.kind === "JIS" && category !== "JIS") warnings.push(`${at(r)}: ${spec.spec_code} は JIS 規格ですが、区分が「${category}」です`);
          }
        }
      }
    }

    if (isCase) {
      // ---- 実車確認記録：汎用マスターへは入れない ----
      const id = caseId ?? (scopeIn ? `DBJ-ROW-${rid}` : undefined);
      if (!caseId) errors.push(`${at(r)}: 実車確認記録ですが、備考に管理ID（DBJ-CASE-…）がありません`);
      if (!code) errors.push(`${at(r)}: 実車確認記録ですが、dbj_product_code（確認した品番）が空です`);
      const confirmed = statusIn === "確認済み";
      if (reply && !confirmed) warnings.push(`${at(r)}: 「${statusIn}」なのに customer_reply_allowed = TRUE です（回答は止めます）`);
      if (reply && confirmed && (!approvedBy || !approvedAt)) errors.push(`${at(r)}: 回答可の実車確認記録には approved_by・approved_at が必要です`);
      cases.push({
        id: `C${pad(rid)}`, case_id: id ?? `DBJ-ROW-${rid}`, maker: str(r.vehicle_maker), car_name: carName, model_code: str(r.model_code),
        engine_code: str(r.engine_code) || null, type_specification_no: typeNo, classification_no: classNo,
        role: roleIn ? role : null, qty: qtyIn ? qty : null, category: category ?? null, spec_code: specCode ?? null,
        own_part_no: code, status: confirmed ? "実車確認済み" : "未確認", customer_use: reply && confirmed,
        scope_note: [str(r.model_year) && `年式欄: ${str(r.model_year)}`, specNote].filter(Boolean).join(" ／ ") || null,
        source_note: str(r.Source_note) || null, approved_by: approvedBy || null, approved_at: approvedAt,
      });
      warnings.push(
        `${at(r)}: 実車 1 台に限る記録（管理ID ${caseId ?? "なし"}）のため、汎用の適合マスターには入れず「実車確認記録」に登録します。型式検索では参考表示のみで、自動回答には使いません`,
      );
      continue;
    }

    // ---- 汎用の適合データ ----
    if (!catIn) errors.push(`${at(r)}: battery_type_spec が空です`);
    if (!rawSpec) errors.push(`${at(r)}: required_battery_code が空です`);
    const p = period(r.model_year, r);
    const approvedRow = reply && statusIn === "確認済み";
    if (approvedRow && !p.from) errors.push(`${at(r)}: 顧客回答可の行には年式（適用期間）が必要です`);
    else if (!p.from) warnings.push(`${at(r)}: 年式が空欄です（期間で絞り込めないため、確認要として扱われます）`);
    if (reply && statusIn && statusIn !== "確認済み") warnings.push(`${at(r)}: 「${statusIn}」なのに customer_reply_allowed = TRUE です（回答は止めます）`);
    if (reply && !code) warnings.push(`${at(r)}: 顧客回答可ですが DBJ 品番が空です`);
    if (format === "19" && approvedRow && (!approvedBy || !approvedAt)) errors.push(`${at(r)}: 確認済み・顧客回答可の行には approved_by・approved_at が必要です`);
    if (specNote && (specNote.length > 30 || /[。．]/.test(specNote)))
      warnings.push(`${at(r)}: spec_note「${specNote.slice(0, 30)}${specNote.length > 30 ? "…" : ""}」は文章のため、装備条件の選択肢として長くなります。「寒冷地仕様|ISS」のように短い語句を | 区切りで入力してください`);
    const src = reply ? SRC_OK : SRC_NG;

    // 同じ車両（主機・補機など複数行）を 1 件にまとめる。ID は内容から決めるため分割取込でも同じになる
    const vKey = [str(r.vehicle_maker), carName, normCode(str(r.model_code)), normCode(str(r.engine_code)), specNote, typeNo ?? "", classNo ?? "", p.from ?? "", p.to ?? ""].join("\u0001");
    const vid = format === "19" ? `V${hash(vKey)}` : `S${pad(rid)}`;
    const vStatus = status ?? "収集済み";
    const prev = vehicles.get(vid);
    if (!prev) {
      vehicles.set(vid, {
        id: vid, maker: str(r.vehicle_maker), car_name: carName, model_code: str(r.model_code), engine_code: str(r.engine_code) || null,
        type_specification_no: typeNo, classification_no: classNo, grade_spec: null, conditions: specNote || null,
        period_basis: BASIS, period_from: p.from, period_to: p.to, period_raw: str(r.model_year) || null,
        status: vStatus, source_id: src, note: str(r.Source_note) || null,
      });
      vehicleRows.set(vid, [r]);
    } else {
      // 1 行でも未確認・回答不可があれば、車両全体を低い方にそろえる（安全側）
      if (STATUS_RANK.indexOf(vStatus) < STATUS_RANK.indexOf(prev.status)) prev.status = vStatus;
      if (src === SRC_NG) prev.source_id = SRC_NG;
      const n = str(r.Source_note);
      if (n && !String(prev.note ?? "").includes(n)) prev.note = [prev.note, n].filter(Boolean).join(" ／ ");
      vehicleRows.get(vid)!.push(r);
    }
    batteries.push({
      id: `SB${pad(rid)}`, vehicle_id: vid, role: role ?? "主機", category: category ?? catIn, spec_code: specCode ?? rawSpec,
      raw_text: rawSpec, qty: qtyIn ? qty : 1, condition: null, status: vStatus, source_id: src,
      // 未承認の行の品番は対応表に入れず、社内参考として要件の備考に残す
      note: code && !approvedRow ? `元データの DBJ 品番: ${code}（${statusIn || "状態不明"}・${reply ? "回答可" : "回答不可"}。未承認のため対応表には入れていません）` : null,
    });

    if (code && specCode && category) {
      if (!own.has(code)) {
        const parsed = parseSpec(specCode);
        const size =
          /^(DIN|EN)/.test(category) || !parsed ? specCode : parsed.kind === "JIS" ? specCode.match(/[A-H]\d{2}/)![0] : specCode.replace(/[LR]$/, "");
        own.set(code, { part_no: code, name: code, category, spec_code: specCode, size_group: size, note: "適合データから自動作成（容量・寸法は未登録）" });
      } else {
        const o = own.get(code)!;
        if (o.category !== category || o.spec_code !== specCode) errors.push(`${at(r)}: 自社品番 ${code} が別の規格（${o.category} ${o.spec_code}）でも使われています`);
      }
      // 規格→自社品番の対応は、確認済み・顧客回答可・承認者ありの行からのみ作る。
      // 対応は全車両で共有されるため、条件不足・未登録の行で下げると、確認済みの他車両まで回答できなくなる。
      // 未確認の車両は車両側の確認状態で回答を止める（安全側は維持される）。
      if (approvedRow) {
        const key = `${category}|${specCode}|${code}`;
        const m = maps.get(key);
        const latest = !m || (approvedAt && (!m.approved_at || approvedAt > m.approved_at));
        maps.set(key, {
          category, spec_code: specCode, own_part_no: code, approved: true,
          approved_by: latest ? approvedBy || null : m!.approved_by, approved_at: latest ? approvedAt : m!.approved_at,
          ids: [...(m?.ids ?? []), rid],
        });
      }
    }
  }

  if (singleMonth.length)
    warnings.unshift(`ID ${singleMonth.join(", ")}: 年式が単月表記（例: 2015/04）です。開始・終了が不明なため「その月のみ」として登録しました。他の月の車両は「該当なし」になります`);

  const batteriesOf = new Map<string, Rec[]>();
  for (const b of batteries) batteriesOf.set(b.vehicle_id, [...(batteriesOf.get(b.vehicle_id) ?? []), b]);

  // 同一車両内の重複要件
  for (const [vid, list] of vehicleRows) {
    const bs = batteriesOf.get(vid) ?? [];
    const roles = bs.map((b) => b.role);
    if (roles.filter((x) => x === "主機").length > 1)
      warnings.push(`型式 ${vehicles.get(vid)!.model_code}（ID ${list.map((r) => str(r.id)).join(", ")}）: 同じ車両条件に主機が複数あります。仕様の違い（spec_note 等）がある場合は列で区別してください`);
  }

  // 同一規格に複数の自社品番 → 自動では選ばない（判定側で確認要）
  const bySpec = new Map<string, string[]>();
  for (const m of maps.values()) bySpec.set(`${m.category} ${m.spec_code}`, [...(bySpec.get(`${m.category} ${m.spec_code}`) ?? []), m.own_part_no]);
  for (const [k, list] of bySpec) if (list.length > 1) warnings.push(`規格 ${k} に自社品番が複数あります（${list.join(" / ")}）。検索時は確認要になります`);

  // 同一型式の行
  const byModel = new Map<string, Rec[]>();
  for (const v of vehicles.values()) byModel.set(v.model_code, [...(byModel.get(v.model_code) ?? []), v]);
  const specOf = (v: Rec) => (batteriesOf.get(v.id) ?? []).map((b) => `${b.role}${b.spec_code}`).sort().join(",");
  for (const [model, list] of byModel) {
    if (list.length < 2) continue;
    if (list.length <= 5) notes.push(`型式 ${model} は ${list.length} 件の車両条件（${list.map((v) => v.period_raw ?? "年式なし").join(" / ")}）。初度登録年月・条件で絞り込みます`);
    if (list.every((v) => v.engine_code === list[0].engine_code && v.conditions === list[0].conditions && specOf(v) === specOf(list[0])))
      warnings.push(`型式 ${model}: 車両条件どうしで原動機・装備条件・規格が同じで、年月以外では区別できません`);
  }

  const mappings = [...maps.values()].map((m) => ({
    // ID は「規格＋自社品番」から決める（分割取込で別の対応を上書きしないため）
    id: `SM-${m.category.replace(/\s+/g, "")}-${m.spec_code.replace(/\s+/g, "")}-${m.own_part_no.replace(/\s+/g, "")}`,
    match_type: "spec", category: m.category, spec_code: m.spec_code, product_id: null, own_part_no: m.own_part_no,
    direction: "双方向", status: m.approved ? "自社対応確認済み" : "未確認", customer_use: m.approved, conditions: null,
    source_id: m.approved ? SRC_OK : SRC_NG,
    approved_by: m.approved ? (format === "19" ? m.approved_by : "DBJ 元データ（確認済み）") : null,
    approved_at: m.approved ? (format === "19" ? m.approved_at : TODAY) : null,
    note: `元データ ID ${m.ids.slice(0, 20).join(", ")}${m.ids.length > 20 ? ` ほか ${m.ids.length - 20} 件` : ""}`,
  }));

  if (format === "legacy") {
    if (mappings.some((m) => m.approved_by)) notes.push("承認者・承認日の列がないため、元データで「確認済み」の対応は承認者「DBJ 元データ（確認済み）」・承認日は変換日としました");
    notes.push("車名の列がないため、車名にはメーカー名を入れています");
    notes.push("主機・補機の区別、個数の列がないため、すべて「主機・1 個」で登録しています");
  } else {
    notes.push("同じ車両条件（メーカー・車名・型式・原動機・仕様・型式指定番号・類別区分番号・年式）の行は 1 台の車両にまとめ、主機・補機をその要件として登録します");
    notes.push("車両・対応の ID は内容から決めるため、分割して取り込んでも同じデータは同じ ID になります");
    notes.push("規格→自社品番の対応は、確認済み・顧客回答可・承認者ありの行からのみ作成します。条件不足・未登録の行の品番は、その車両の要件の備考（社内参考）に残します");
  }
  notes.push(`期間の基準は「${BASIS}」として登録しました`);
  notes.push("reply_template は取り込みません。回答文は承認済みの品番から自動生成します（品番との不一致は取込エラーにします）");
  if (cases.length) notes.push(`実車確認記録 ${cases.length} 件は、型式検索で「参考：実車確認記録」として表示し、確定回答・自動返信には使いません`);

  const hasGeneral = vehicles.size > 0;
  const data: Partial<Record<DatasetId, Rec[]>> = {
    sources: hasGeneral ? sources : [],
    own_products: [...own.values()],
    vehicles: [...vehicles.values()],
    vehicle_batteries: batteries,
    own_mappings: mappings,
    vehicle_cases: cases,
  };
  const csv: FlatResult["csv"] = {};
  const counts: FlatResult["counts"] = {};
  for (const id of FLAT_ORDER) {
    counts[id] = data[id]!.length;
    // エラーがある場合・0 件の場合は取込用 CSV を作らない
    if (!errors.length && data[id]!.length) csv[id] = Papa.unparse(data[id]!, { newline: "\n", columns: getDataset(id)!.columns.map((c) => c.name) }) + "\n";
  }
  return { ok: errors.length === 0, format, rowCount: rows.length, errors, warnings, notes, csv, counts };
}
