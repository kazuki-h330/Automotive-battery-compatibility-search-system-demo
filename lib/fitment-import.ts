// DBJ 適合データ（19 列 v4・判定付き）の取込変換。
// v4 では DBJ 様が行ごとに「DBJ判定・表示文・補足表示・適合品番」を決めて承認しているため、
// 本システムでは規格→自社品番の対応から判定し直さず、行の内容をそのまま fitments に登録して表示する。
//
//   ・DBJ判定 / 表示文 / 補足表示は、専用列（dbj_judgment / display_text / display_note）があればそれを使い、
//     なければ Source_note の「項目名:内容」（「; 」区切り）から取り出す
//   ・Source_note の原文は社内用として残す（お客様には表示しない）
//   ・推測で埋めない。判定に影響する不備はエラー、運用上の確認事項は警告にまとめる
import Papa from "papaparse";
import { FITMENT_JUDGMENTS, FITMENT_STATUS, PRODUCT_JUDGMENTS, getDataset } from "./datasets.ts";

/** v4 で追加をお願いしている専用列（任意・19 列の後ろ） */
export const FITMENT_EXTRA = ["dbj_judgment", "display_text", "display_note"] as const;
const BASE_19 = ["id", "vehicle_maker", "car_name", "model_code", "model_year", "engine_code", "spec_note", "battery_type_spec", "battery_position", "quantity", "required_battery_code", "dbj_product_code", "status", "customer_reply_allowed", "Source_note", "approved_by", "approved_at", "type_specification_no", "classification_no"];

type Rec = Record<string, any>;
const str = (v: unknown) => String(v ?? "").trim();
const clean = (t: string) => t.replace(/^﻿/, "");

/** Source_note を「項目名:内容」に分ける（同じ項目は先頭を採用）。URL 等の区切りの誤検出を避けるため項目名は 20 文字以内 */
export function parseSourceNote(s: string) {
  const out: Record<string, string> = {};
  for (const part of str(s).split(/;\s+/)) {
    const m = part.match(/^([^:：;]{1,20})[:：]([\s\S]*)$/);
    if (m && !(m[1].trim() in out)) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

/** spec_note の「仕様:」の値（標準仕様・寒冷地仕様・4WD 等）。なければ null */
export function variantOf(specNote: string) {
  const m = str(specNote).match(/(?:^|;\s*)仕様[:：]([^;]*)/);
  return m ? m[1].trim() || null : null;
}

/** v4 形式（判定付き）の CSV か：19 列がそろい、専用列または Source_note の「DBJ判定:」がある */
export function isFitmentCsv(text: string) {
  const head = clean(text).slice(0, 200_000);
  const headers = Papa.parse<string[]>(head.split(/\r?\n/, 1)[0] ?? "").data[0]?.map((h) => str(h)) ?? [];
  if (!BASE_19.every((c) => headers.includes(c))) return false;
  return headers.includes("dbj_judgment") || /DBJ判定[:：]/.test(head);
}

export type FitmentResult = {
  ok: boolean;
  format: "fitment";
  testOnly: false;
  hasFlags: false;
  rowCount: number;
  errors: string[];
  warnings: string[];
  notes: string[];
  csv: { fitments?: string };
  counts: { fitments?: number };
};

export function convertFitment(text: string): FitmentResult {
  const { data: rows, meta, errors: parseErrors } = Papa.parse<Rec>(clean(text), { header: true, skipEmptyLines: "greedy", delimiter: "," });
  const fields = (meta.fields ?? []).map((f) => f.trim());
  const errors = parseErrors.slice(0, 50).map((e) => `CSV 形式エラー（${e.row != null ? e.row + 2 : "?"} 行目）: ${e.message}`);
  const warnings: string[] = [];
  const notes: string[] = [];
  const base = { format: "fitment" as const, testOnly: false as const, hasFlags: false as const, rowCount: rows.length, warnings, notes };

  const absent = BASE_19.filter((c) => !fields.includes(c));
  if (absent.length) return { ...base, ok: false, errors: [`必須列がありません: ${absent.join(", ")}`], csv: {}, counts: {} };
  const unknown = fields.filter((f) => !BASE_19.includes(f) && !(FITMENT_EXTRA as readonly string[]).includes(f));
  if (unknown.length) warnings.push(`未定義の列は取り込みません: ${unknown.join(", ")}`);
  const core = fields.filter((f) => BASE_19.includes(f));
  if (core.join(",") !== BASE_19.join(",")) warnings.push("19 列の並びが正式な列順と異なります（列名で読み込むため取込は可能です）");
  if (!/\r\n/.test(text.slice(0, 5000)) && /\n/.test(text)) notes.push("改行コードが LF でした（CRLF が基本ですが、どちらでも取り込めます）");
  const dedicated = FITMENT_EXTRA.filter((c) => fields.includes(c));

  // 行ごとのエラーは件数が多くなりうるため、同じ内容は ID をまとめる
  const grouped = new Map<string, string[]>();
  const err = (msg: string, id: string) => grouped.set(msg, [...(grouped.get(msg) ?? []), id]);
  const warnIds = new Map<string, string[]>();
  const warn = (msg: string, id: string) => warnIds.set(msg, [...(warnIds.get(msg) ?? []), id]);

  const seen = new Set<string>();
  const out: Rec[] = [];
  let coldRows = 0, twoSlots = 0, fromNote = 0;
  for (const r of rows) {
    const id = str(r.id);
    const at = id || "?";
    if (!id) err("id が空です", at);
    else if (seen.has(id)) err("id が重複しています", at);
    seen.add(id);
    if (/-C$/.test(id)) coldRows++;

    const maker = str(r.vehicle_maker);
    const car = str(r.car_name);
    const model = str(r.model_code);
    if (!maker) err("vehicle_maker が空です", at);
    if (!model && !car) err("model_code と car_name の両方が空です（照合できません）", at);

    const status = str(r.status);
    if (!(FITMENT_STATUS as readonly string[]).includes(status)) err(`status「${status}」は「承認済み」または「現車確認待ち」で入力してください`, at);
    const replyRaw = str(r.customer_reply_allowed).normalize("NFKC");
    const reply = /^true$/i.test(replyRaw);
    if (!/^(true|false)$/i.test(replyRaw)) err(`customer_reply_allowed「${replyRaw}」は TRUE / FALSE で入力してください`, at);

    const note = parseSourceNote(r.Source_note);
    const judgment = str(r.dbj_judgment) || note["DBJ判定"] || "";
    const display = str(r.display_text) || note["表示文"] || "";
    const sub = str(r.display_note) || note["補足表示"] || "";
    if (!str(r.dbj_judgment) && note["DBJ判定"]) fromNote++;
    if (!judgment) err("DBJ判定がありません（Source_note の「DBJ判定:」または dbj_judgment 列）", at);
    else if (!(FITMENT_JUDGMENTS as readonly string[]).includes(judgment)) err(`DBJ判定「${judgment}」は未定義です（${FITMENT_JUDGMENTS.join(" / ")}）`, at);
    if (!display) err("表示文がありません（Source_note の「表示文:」または display_text 列）", at);

    const code = str(r.dbj_product_code);
    const approvedBy = str(r.approved_by);
    const approvedAt = str(r.approved_at).normalize("NFKC");
    if (approvedAt && !/^\d{4}-\d{2}-\d{2}$/.test(approvedAt)) err(`approved_at「${approvedAt}」は YYYY-MM-DD で入力してください`, at);
    if (reply) {
      // 自動回答してよい行は、承認済み・承認者・承認日がそろっていること
      if (status !== "承認済み") err(`customer_reply_allowed = TRUE ですが status が「${status}」です（自動回答は承認済みの行のみ）`, at);
      if (!approvedBy || !approvedAt) err("customer_reply_allowed = TRUE の行には approved_by・approved_at が必要です", at);
      if ((PRODUCT_JUDGMENTS as readonly string[]).includes(judgment) && !code) err(`DBJ判定「${judgment}」で自動回答可ですが、dbj_product_code（適合品番）が空です`, at);
      if (judgment === "現車確認待ち") err("DBJ判定が「現車確認待ち」なのに customer_reply_allowed = TRUE です", at);
    }
    if (status === "現車確認待ち" && judgment && judgment !== "現車確認待ち") warn(`status は「現車確認待ち」ですが DBJ判定が「${judgment}」です（自動回答はしません）`, at);
    if ((judgment === "C" || judgment === "D") && code) warn("DBJ判定 C・D（適合する互換製品なし）ですが dbj_product_code に品番があります（表示はしません）", at);
    if (reply && /顧客回答への利用は未確認/.test(note["利用条件"] ?? "")) warn("Source_note の利用条件が「顧客回答への利用は未確認」ですが、customer_reply_allowed = TRUE です（customer_reply_allowed に従い自動回答します）", at);

    const qtyIn = str(r.quantity).normalize("NFKC");
    const qty = qtyIn ? Number(qtyIn) : null;
    if (qtyIn && !(Number.isInteger(qty) && qty! >= 1)) err(`quantity「${qtyIn}」は 1 以上の整数で入力してください`, at);
    const pos = str(r.battery_position);
    if (pos === "補機") warn("battery_position が「補機」です（搭載位置ではなく用途の記載。そのまま表示します）", at);
    if (/2個目/.test(code)) twoSlots++;
    if (str(r.model_year)) warn("model_year は使用しません（年式での絞り込みは未対応のため、原文は Source_note を参照）", at);

    out.push({
      id, maker, car_name: car || null, model_code: model || null, engine_code: str(r.engine_code) || null,
      spec_note: str(r.spec_note) || null, variant: variantOf(r.spec_note), battery_type_spec: str(r.battery_type_spec) || null,
      battery_position: pos || null, quantity: qty, required_battery_code: str(r.required_battery_code) || null,
      dbj_product_code: code || null, status, customer_reply_allowed: reply ? "true" : "false", judgment, display_text: display,
      display_note: sub || null, source_note: str(r.Source_note) || null, approved_by: approvedBy || null, approved_at: approvedAt || null,
      type_specification_no: str(r.type_specification_no) || null, classification_no: str(r.classification_no) || null,
    });
  }

  const ids = (list: string[]) => `${list.slice(0, 20).join(", ")}${list.length > 20 ? ` ほか ${list.length - 20} 件` : ""}`;
  for (const [m, list] of grouped) errors.push(`${m}: ID ${ids(list)}（${list.length} 行）`);
  for (const [m, list] of warnIds) warnings.push(`${m}: ID ${ids(list)}（${list.length} 行）`);
  const blankModel = out.filter((r) => !r.model_code).length;
  if (blankModel) warnings.push(`model_code が空欄の行 ${blankModel} 行は、車名（car_name）で照合します`);
  const blankQty = out.filter((r) => r.quantity == null).length;
  if (blankQty) warnings.push(`quantity が空欄の行 ${blankQty} 行は、個数を表示しません（回答文では 1 個として扱います）`);

  notes.push(`DBJ 適合データ（判定付き）として ${out.length} 行を「${getDataset("fitments")!.label}」に登録します。DBJ判定・表示文・適合品番は元データのまま使い、本システムで判定し直しません`);
  notes.push(
    dedicated.length
      ? `専用列（${dedicated.join(", ")}）の値を優先し、空欄のときは Source_note から取り出しました`
      : `DBJ判定・表示文・補足表示は Source_note の「項目名:内容」から取り出しました（${fromNote} 行）`,
  );
  notes.push("お客様に表示するのは、適合品番・表示文・補足表示・搭載位置のみです。Source_note のその他の項目は社内表示のみです");
  notes.push("customer_reply_allowed = FALSE（現車確認待ち）の行は適合品を返さず、表示文（ラベル写真のお願い）を表示してスタッフに引き継ぎます");
  if (coldRows) notes.push(`寒冷地仕様の行（id 末尾「-C」）${coldRows} 行は、spec_note の「仕様:」で標準仕様と区別します`);
  if (twoSlots) notes.push(`2 個積みの品番（「1個目（…）：… ／ 2個目（…）：…」）${twoSlots} 行は、表記のまま表示します`);
  notes.push("「#」を含む型式（例: M-HA#）は、「#」を数字として照合します（例: M-HA1、M-HA5）");
  notes.push("model_year が空欄のため、年式での絞り込みは行いません。同じ型式で判定が分かれる場合は、仕様・原動機型式などを確認してから回答します");

  const ok = errors.length === 0;
  const cols = getDataset("fitments")!.columns.map((c) => c.name);
  return {
    ...base,
    ok,
    errors,
    csv: ok && out.length ? { fitments: Papa.unparse(out, { newline: "\n", columns: cols }) + "\n" } : {},
    counts: { fitments: out.length },
  };
}
