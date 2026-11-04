// DBJ 既存形式（1 行 = 1 車両適合の横長 CSV）を、本システムの定型 CSV 5 種に変換する。
//   node scripts/convert-flat.mjs <入力CSV> <出力フォルダ> [--basis 初度登録]
// 出力: sources / own_products / vehicles / vehicle_batteries / own_mappings の CSV と report.md
// 推測で埋めた値・判定に影響する不備はすべて report.md に記録する（自動で直さない）。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { parseSpec } from "../lib/normalize.ts";
import { getDataset } from "../lib/datasets.ts";

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) {
  console.error("使い方: node scripts/convert-flat.mjs <入力CSV> <出力フォルダ> [--basis 初度登録]");
  process.exit(1);
}
const basisArg = process.argv.indexOf("--basis");
const BASIS = basisArg > 0 ? process.argv[basisArg + 1] : "初度登録";
const TODAY = new Date().toISOString().slice(0, 10);

const text = readFileSync(input, "utf8").replace(/^﻿/, "");
const { data: rows } = Papa.parse(text, { header: true, skipEmptyLines: true, delimiter: "," });

const errors = [];
const warnings = [];
const notes = [];
const singleMonth = [];
const at = (r) => `ID ${r.id}（${r.vehicle_maker} ${r.model_code}）`;

const STATUS = { 確認済み: "適合確認済み", 条件不足: "解析済み", 未登録: "収集済み" };
const CATEGORIES = ["JIS", "JIS EFB", "LN", "LN EFB", "LN AGM"];
const bool = (v) => /^(true|1|yes|はい|可)$/i.test(String(v ?? "").trim());
const pad = (id) => String(id).padStart(3, "0");

/** 年式表記 → 期間。単月表記は「その月のみ」として扱い、範囲を推測しない */
function period(raw, r) {
  const s = String(raw ?? "").trim().replace(/[～〜~]/g, "-");
  const ym = (x) => x.replace("/", "-");
  let m = s.match(/^(\d{4}\/\d{2})-(\d{4}\/\d{2})$/);
  if (m) return { from: ym(m[1]), to: ym(m[2]) };
  m = s.match(/^(\d{4}\/\d{2})-$/);
  if (m) return { from: ym(m[1]), to: null };
  m = s.match(/^(\d{4}\/\d{2})$/);
  if (m) {
    singleMonth.push(r.id);
    return { from: ym(m[1]), to: ym(m[1]) };
  }
  m = s.match(/^(\d{4})$/);
  if (m) {
    warnings.push(`${at(r)}: 年式「${s}」は年のみのため、月の比較はできません（確認要として扱われます）`);
    return { from: m[1], to: null };
  }
  errors.push(`${at(r)}: 年式「${s}」を解釈できません`);
  return { from: null, to: null };
}

const sources = [
  { id: "SRC-S-OK", name: "DBJ 提供サンプル（顧客回答可）", kind: "DBJ確認", usage_condition: "顧客回答に利用可", internal_only: false, customer_use: true, note: "customer_reply_allowed = TRUE の行" },
  { id: "SRC-S-NG", name: "DBJ 提供サンプル（顧客回答不可）", kind: "DBJ確認", usage_condition: "社内確認用。顧客回答不可", internal_only: true, customer_use: false, note: "customer_reply_allowed = FALSE の行" },
];
const vehicles = [];
const batteries = [];
const own = new Map();
const maps = new Map();

for (const r of rows) {
  const status = STATUS[r.status?.trim()];
  if (!status) errors.push(`${at(r)}: status「${r.status}」は未定義です（確認済み / 条件不足 / 未登録）`);
  const category = r.battery_type_spec?.trim();
  if (!CATEGORIES.includes(category)) errors.push(`${at(r)}: battery_type_spec「${category}」は未定義です`);
  const spec = parseSpec(r.required_battery_code ?? "");
  if (!spec) errors.push(`${at(r)}: 規格「${r.required_battery_code}」を解析できません`);
  else if (spec.kind === "ISS" && category !== "JIS EFB") warnings.push(`${at(r)}: ${spec.spec_code} はアイドリングストップ車用規格ですが、区分が「${category}」です`);
  else if (spec.kind === "LN" && !category?.startsWith("LN")) warnings.push(`${at(r)}: ${spec.spec_code} は LN 規格ですが、区分が「${category}」です`);
  else if (spec.kind === "JIS" && category !== "JIS") warnings.push(`${at(r)}: ${spec.spec_code} は JIS 規格ですが、区分が「${category}」です`);

  const reply = bool(r.customer_reply_allowed);
  const code = r.dbj_product_code?.trim();
  if (reply && r.status?.trim() !== "確認済み") warnings.push(`${at(r)}: 「${r.status}」なのに customer_reply_allowed = TRUE です（回答は止めます）`);
  if (reply && !code) warnings.push(`${at(r)}: 顧客回答可ですが DBJ 品番が空です`);
  if (code && r.reply_template && !r.reply_template.includes(code))
    errors.push(`${at(r)}: reply_template の品番が dbj_product_code「${code}」と一致しません`);

  const p = period(r.model_year, r);
  const vid = `S${pad(r.id)}`;
  const src = reply ? "SRC-S-OK" : "SRC-S-NG";
  vehicles.push({
    id: vid, maker: r.vehicle_maker, car_name: r.vehicle_maker, model_code: r.model_code.trim(), engine_code: r.engine_code,
    grade_spec: null, conditions: null, period_basis: BASIS, period_from: p.from, period_to: p.to, period_raw: r.model_year,
    status: status ?? "収集済み", source_id: src, note: r.Source_note,
  });
  batteries.push({
    id: `SB${pad(r.id)}`, vehicle_id: vid, role: "主機", category, spec_code: spec?.spec_code ?? r.required_battery_code,
    raw_text: r.required_battery_code, qty: 1, condition: null, status: status ?? "収集済み", source_id: src, note: null,
  });

  if (code && spec) {
    if (!own.has(code)) {
      const size = spec.kind === "JIS" ? spec.spec_code.match(/[A-H]\d{2}/)[0] : spec.spec_code.replace(/[LR]$/, "");
      own.set(code, { part_no: code, name: code, category, spec_code: spec.spec_code, size_group: size, note: "サンプルから自動作成（容量・寸法は未登録）" });
    } else {
      const o = own.get(code);
      if (o.category !== category || o.spec_code !== spec.spec_code)
        errors.push(`${at(r)}: 自社品番 ${code} が別の規格（${o.category} ${o.spec_code}）でも使われています`);
    }
    const key = `${category}|${spec.spec_code}|${code}`;
    const approved = reply && r.status?.trim() === "確認済み";
    const prev = maps.get(key);
    if (prev && prev.approved !== approved) warnings.push(`${at(r)}: ${category} ${spec.spec_code} → ${code} の確認状態が行によって異なるため「未確認」にしました`);
    maps.set(key, { category, spec_code: spec.spec_code, own_part_no: code, approved: prev ? prev.approved && approved : approved, ids: [...(prev?.ids ?? []), r.id] });
  }
}

if (singleMonth.length)
  warnings.unshift(`ID ${singleMonth.join(", ")}: 年式が単月表記（例: 2015/04）です。開始・終了が不明なため「その月のみ」として登録しました。他の月の車両は「該当なし」になります`);

// 同一規格に複数の自社品番 → 自動では選ばない（判定側で確認要）
const bySpec = new Map();
for (const m of maps.values()) bySpec.set(`${m.category} ${m.spec_code}`, [...(bySpec.get(`${m.category} ${m.spec_code}`) ?? []), m.own_part_no]);
for (const [k, list] of bySpec) if (list.length > 1) warnings.push(`規格 ${k} に自社品番が複数あります（${list.join(" / ")}）。検索時は確認要になります`);

// 同一型式で期間が重なる行
const byModel = Object.groupBy(vehicles, (v) => v.model_code);
for (const [model, list] of Object.entries(byModel)) {
  if (list.length < 2) continue;
  notes.push(`型式 ${model} は ${list.length} 行（${list.map((v) => `ID ${Number(v.id.slice(1))}: ${v.period_raw}`).join(" / ")}）。初度登録年月で絞り込みます`);
  if (list.every((v) => v.engine_code === list[0].engine_code && batteries.find((b) => b.vehicle_id === v.id).spec_code === batteries.find((b) => b.vehicle_id === list[0].id).spec_code))
    warnings.push(`型式 ${model}: 行どうしで原動機・規格が同じで、分岐の理由（装備仕様など）を表す列がありません。年月以外では区別できません`);
}

const mappings = [...maps.values()].map((m, i) => ({
  id: `SM${pad(i + 1)}`, match_type: "spec", category: m.category, spec_code: m.spec_code, product_id: null, own_part_no: m.own_part_no,
  direction: "双方向", status: m.approved ? "自社対応確認済み" : "未確認", customer_use: m.approved, conditions: null,
  source_id: m.approved ? "SRC-S-OK" : "SRC-S-NG",
  approved_by: m.approved ? "DBJ 元データ（確認済み）" : null, approved_at: m.approved ? TODAY : null,
  note: `元データ ID ${m.ids.join(", ")}`,
}));
if (mappings.some((m) => m.approved_by))
  notes.push(`承認者・承認日の列がないため、元データで「確認済み」の対応は承認者「DBJ 元データ（確認済み）」・承認日 ${TODAY}（変換日）としました`);

notes.push(`期間の基準は「${BASIS}」として登録しました（元データに基準の列がないため要確認）`);
notes.push("車名の列がないため、車名にはメーカー名を入れています");
notes.push("主機・補機の区別、個数の列がないため、すべて「主機・1 個」で登録しています");
notes.push("reply_template は取り込みません。回答文は承認済みの品番から自動生成します（品番との不一致は取込エラーにします）");

mkdirSync(outDir, { recursive: true });
const out = { sources, own_products: [...own.values()], vehicles, vehicle_batteries: batteries, own_mappings: mappings };
for (const [name, list] of Object.entries(out)) writeFileSync(path.join(outDir, `${name}.csv`), Papa.unparse(list, { newline: "\n", columns: getDataset(name).columns.map((c) => c.name) }) + "\n");

const report = [
  `# 変換レポート: ${path.basename(input)}`,
  "",
  `入力 ${rows.length} 行 → 車両 ${vehicles.length} / 搭載要件 ${batteries.length} / 自社品番 ${own.size} / 自社対応 ${mappings.length} / 出典 ${sources.length}`,
  "",
  `## エラー（${errors.length} 件・取込不可）`,
  ...(errors.length ? errors.map((e) => `- ${e}`) : ["- なし"]),
  "",
  `## 要確認（${warnings.length} 件）`,
  ...(warnings.length ? warnings.map((e) => `- ${e}`) : ["- なし"]),
  "",
  "## 変換時の扱い",
  ...notes.map((e) => `- ${e}`),
  "",
].join("\n");
writeFileSync(path.join(outDir, "report.md"), report);
console.log(report);
process.exit(errors.length ? 2 : 0);
