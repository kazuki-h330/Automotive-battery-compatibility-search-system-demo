// 検索用の正規化。原表記は DB にそのまま残し、比較時のみ正規化値を使う。

/** 全角→半角・大文字化・空白除去。ハイフン（型式の接頭辞区切り）は残す */
export function normModel(s: string | null | undefined) {
  return (s ?? "").normalize("NFKC").toUpperCase().replace(/[\s　]+/g, "").replace(/[‐－―ー]/g, "-");
}

/** 品番照合キー：記号の揺れ（空白・ハイフン・スラッシュ）を吸収 */
export function partKey(s: string | null | undefined) {
  return (s ?? "").normalize("NFKC").toUpperCase().replace(/[\s　\-‐－―ー/_.]+/g, "");
}

/** 接頭辞（例：3BA-、DBA-）を外した形。照合には使わず「候補のヒント」表示のみに使う */
export function withoutPrefix(model: string) {
  const m = normModel(model);
  const i = m.indexOf("-");
  return i > 0 && i <= 4 ? m.slice(i + 1) : m;
}

export type ParsedSpec = { kind: "JIS" | "ISS" | "LN"; spec_code: string; categoryHint?: string };

/** 規格表記の解析（例：55B24L、N-55、LN2）。判別できなければ null */
export function parseSpec(input: string): ParsedSpec | null {
  const s = normModel(input).replace(/[()（）]/g, "");
  let m = s.match(/^(\d{2,3})([A-H])(\d{2})([LR])?$/);
  if (m) return { kind: "JIS", spec_code: `${m[1]}${m[2]}${m[3]}${m[4] ?? ""}`, categoryHint: "JIS" };
  m = s.match(/^([K-W])-?(\d{2,3})([LR])?$/);
  if (m) return { kind: "ISS", spec_code: `${m[1]}-${m[2]}${m[3] ?? ""}`, categoryHint: "JIS EFB" };
  // LN は容量付きの表記（例: LN4 80Ah AGM）も受け付ける。規格表記は LN 番号のみ（容量は原文に残す）。Li-ion 等は対象外
  m = s.match(/^LN-?([0-6])(?:(\d{2,3})AH)?(EFB|AGM)?$/);
  if (m) return { kind: "LN", spec_code: `LN${m[1]}`, categoryHint: m[3] ? `LN ${m[3]}` : undefined };
  return null;
}

/** 'YYYY-MM' のみ月精度として扱う。年のみ・不明表記から月を推測しない */
export function isMonth(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function splitList(s: string | null | undefined) {
  return (s ?? "")
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}
