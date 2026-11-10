// DBJ 既存形式（1 行 = 1 車両適合の横長 CSV）を、本システムの定型 CSV 5 種に変換する。
//   node scripts/convert-flat.mjs <入力CSV> <出力フォルダ> [--basis 初度登録]
// 出力: sources / own_products / vehicles / vehicle_batteries / own_mappings / vehicle_cases の CSV（0 件のものは出力しない）と report.md
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { convertFlat } from "../lib/flat.ts";

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) {
  console.error("使い方: node scripts/convert-flat.mjs <入力CSV> <出力フォルダ> [--basis 初度登録] [--test]");
  process.exit(1);
}
const basisArg = process.argv.indexOf("--basis");
const r = convertFlat(readFileSync(input, "utf8"), { basis: basisArg > 0 ? process.argv[basisArg + 1] : undefined, testOnly: process.argv.includes("--test") });

mkdirSync(outDir, { recursive: true });
for (const [name, csv] of Object.entries(r.csv)) writeFileSync(path.join(outDir, `${name}.csv`), csv);

const report = [
  `# 変換レポート: ${path.basename(input)}`,
  "",
  `入力 ${r.rowCount} 行 → 車両 ${r.counts.vehicles ?? 0} / 搭載要件 ${r.counts.vehicle_batteries ?? 0} / 自社品番 ${r.counts.own_products ?? 0} / 自社対応 ${r.counts.own_mappings ?? 0} / 出典 ${r.counts.sources ?? 0} / 実車確認記録 ${r.counts.vehicle_cases ?? 0}（${r.format === "19" ? "19 列形式" : "旧形式"}）`,
  "",
  `## エラー（${r.errors.length} 件・取込不可）`,
  ...(r.errors.length ? r.errors.map((e) => `- ${e}`) : ["- なし"]),
  "",
  `## 要確認（${r.warnings.length} 件）`,
  ...(r.warnings.length ? r.warnings.map((e) => `- ${e}`) : ["- なし"]),
  "",
  "## 変換時の扱い",
  ...r.notes.map((e) => `- ${e}`),
  "",
].join("\n");
writeFileSync(path.join(outDir, "report.md"), report);
console.log(report);
process.exit(r.ok ? 0 : 2);
