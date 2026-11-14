// DBJ 適合データ（判定付き）による車両検索。DB アクセスを持たない純粋関数。
// DBJ 様の判定・表示文をそのまま使い、本システムでは「どの行が該当するか」だけを決める。
//   ・該当行の回答（品番・表示文・補足表示・搭載位置）がすべて同じ → その回答を表示
//   ・回答が分かれる → 車名・メーカー・原動機型式・仕様のうち、違いのある項目を確認してから回答（先頭行・多数派は採用しない）
//   ・現車確認待ち（自動回答不可）→ 適合品は返さず、表示文（ラベル写真のお願い）を表示してスタッフに引き継ぐ
// お客様向けに出すのは、適合品番・表示文・補足表示・搭載位置のみ。Source_note のその他の項目は社内表示のみ。

import { normModel, withoutPrefix } from "./normalize.ts";
import type { Row } from "./db";
import type { JudgeResult, VehicleQuery } from "./judge";

export const PHOTO_TEXT =
  "この車は適合の確認が必要です。今ついているバッテリーのラベル（品番が書かれた部分）の写真をお送りください。確認のうえ、ご案内します。";

/** 車名の照合キー（全角→半角・大文字・空白除去） */
export function nameKey(s: unknown) {
  return String(s ?? "").normalize("NFKC").toUpperCase().replace(/[\s　]+/g, "");
}

/** 型式の照合。「#」は 1 桁以上の数字として扱う（例: M-HA# は M-HA1・M-HA5 に一致） */
export function modelMatches(rowModel: unknown, input: string) {
  const m = normModel(String(rowModel ?? ""));
  const q = normModel(input);
  if (!m || !q) return false;
  if (m === q) return true;
  if (!m.includes("#")) return false;
  const re = new RegExp(`^${m.split("#").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[0-9]+")}$`);
  return re.test(q);
}

const truthy = (v: unknown) => v === true || v === "true" || v === "t";
const isProduct = (j: string) => ["A", "条件付きA", "B", "一部適合"].includes(j);

export type FitmentOption = { key: "carName" | "maker" | "engineCode" | "variant" | "currentBattery"; label: string; values: string[] };
export type FitmentPart = { slot?: string; codes: string[] };

/** 適合品番の表記を分ける。「1個目（80D26L）：A、B ／ 2個目（LN1）：C」は個ごと、「A、B」は候補として扱う */
export function splitProductCode(code: unknown): FitmentPart[] {
  const s = String(code ?? "").trim();
  if (!s) return [];
  return s.split(/\s*／\s*/).map((seg) => {
    const m = seg.match(/^(\d+個目[（(][^）)]*[）)])\s*[：:]\s*(.*)$/);
    const body = m ? m[2] : seg;
    return { slot: m?.[1], codes: body.split(/\s*[、,，]\s*/).filter(Boolean) };
  });
}

const HEADLINE: Record<string, string> = {
  A: "適合品番があります",
  条件付きA: "適合品番があります（注意事項あり）",
  B: "適合の可能性があります（お客様への確認事項あり）",
  一部適合: "一部適合の品番があります（注意事項あり）",
  C: "現時点では適合する互換製品がありません",
  D: "現時点では適合する互換製品がありません",
};

/** お客様向けの回答が同じかどうかを比べるキー */
const answerKey = (r: Row) =>
  [r.judgment, r.dbj_product_code, r.display_text, r.display_note, r.battery_position, r.quantity, r.status, truthy(r.customer_reply_allowed)].map((x) => x ?? "").join("\u0001");

/** 型式・車名で該当する行を選ぶ（接頭辞違いは採用しない） */
function pick(q: VehicleQuery, rows: Row[]) {
  const model = rows.filter((r) => r.model_code && modelMatches(r.model_code, q.modelCode));
  if (model.length) return { hits: model, by: "model" as const };
  // 型式のない車（正規輸入のない輸入車等）は車名で照合する（DBJ 様ご指定）
  const key = nameKey(q.modelCode);
  const named = key.length >= 2 ? rows.filter((r) => !r.model_code && nameKey(r.car_name).startsWith(key)) : [];
  return { hits: named, by: "name" as const };
}

/** 接頭辞違いの登録（自動では採用しない）のヒント */
export function fitmentHints(q: VehicleQuery, rows: Row[]) {
  const norm = normModel(q.modelCode);
  const tail = withoutPrefix(norm);
  return [
    ...new Set(
      rows
        .filter((r) => r.model_code && !modelMatches(r.model_code, q.modelCode) && withoutPrefix(normModel(r.model_code)) === tail && tail)
        .map((r) => `接頭辞違いの登録あり: ${r.model_code}（${r.maker} ${r.car_name ?? ""}）— 自動では採用しません。車検証の型式を再確認してください`),
    ),
  ].slice(0, 10);
}

/** 該当行がなければ null（従来の車両マスターで判定する） */
export function judgeFitment(q: VehicleQuery, rows: Row[]): JudgeResult | null {
  const { hits, by } = pick(q, rows);
  if (!hits.length) return null;
  const norm = normModel(q.modelCode);
  const steps = [
    by === "model" ? `型式「${q.modelCode}」→「${norm}」で照合: DBJ 適合データ ${hits.length} 行（「#」は数字として照合）` : `型式の登録がない車として、車名「${q.modelCode}」で照合: ${hits.length} 行`,
  ];
  const base = { kind: "vehicle" as const, trace: { input: q, normalized: norm, steps }, candidates: [], internalParts: [], hints: [] as string[] };

  // 指定された条件で絞り込む（原動機型式が未登録の行は除外しない）
  let live = hits;
  const narrow = (label: string, f: (r: Row) => boolean) => {
    live = live.filter(f);
    steps.push(`${label} → ${live.length} 行`);
  };
  if (q.carName) narrow(`車名「${q.carName}」`, (r) => nameKey(r.car_name) === nameKey(q.carName));
  if (q.maker) narrow(`車両メーカー「${q.maker}」`, (r) => r.maker === q.maker);
  const eng = normModel(q.engineCode);
  if (eng) narrow(`原動機型式「${eng}」`, (r) => !r.engine_code || normModel(r.engine_code) === eng);
  if (q.conditions && q.conditions.length) {
    const sel = new Set(q.conditions);
    // 「記載なし」（LINE の選択肢）・空文字は「仕様:」の記載がない行
    narrow(`仕様「${q.conditions.join("・")}」`, (r) => sel.has(r.variant ?? "") || (!r.variant && sel.has("記載なし")));
  }
  if (q.currentBattery) narrow(`今ついているバッテリー「${q.currentBattery}」`, (r) => (r.required_battery_code ?? "") === q.currentBattery);
  if (q.regYm) steps.push("初度登録年月は DBJ 適合データに年式がないため、絞り込みに使いません");

  if (!live.length)
    return {
      ...base,
      fitments: hits,
      state: "not_found",
      headline: "入力条件に一致する車両データがありません",
      reasons: ["型式は登録されていますが、入力された条件（車名・メーカー・原動機型式・仕様）に一致する行がありません。条件を確認してください"],
      missing: [],
    };

  const groups = new Map<string, Row[]>();
  for (const r of live) groups.set(answerKey(r), [...(groups.get(answerKey(r)) ?? []), r]);

  if (groups.size > 1) {
    // 回答が分かれる：違いのある項目を確認する
    const dims: { key: FitmentOption["key"]; label: string; of: (r: Row) => string; given: boolean }[] = [
      { key: "carName", label: "車名", of: (r) => r.car_name ?? "", given: !!q.carName },
      { key: "maker", label: "車両メーカー", of: (r) => r.maker ?? "", given: !!q.maker },
      { key: "variant", label: "仕様", of: (r) => r.variant ?? "", given: !!q.conditions?.length },
      { key: "engineCode", label: "原動機型式", of: (r) => r.engine_code ?? "", given: !!eng },
      // 年式がないため、同じ車で純正バッテリーが違う行が多い。今ついているバッテリーのラベルで区別する
      // （LINE ではお客様に純正品番を示さず、ラベル写真をお願いしてスタッフが選ぶ）
      { key: "currentBattery", label: "今ついているバッテリーの品番", of: (r) => r.required_battery_code ?? "", given: !!q.currentBattery },
    ];
    const options: FitmentOption[] = dims
      .filter((d) => !d.given && new Set(live.map(d.of)).size > 1)
      .map((d) => ({ key: d.key, label: d.label, values: [...new Set(live.map(d.of))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "ja"))) }));
    steps.push(`お客様向けの回答が ${groups.size} 通りに分かれる → 自動では選ばない`);
    if (options.length) {
      return {
        ...base,
        fitments: live,
        options,
        state: "needs_check",
        headline: "同じ型式で回答が分かれます。条件を選んでください",
        reasons: ["同じ型式で、仕様などにより適合品番・表示文が異なります（先頭行・多数派は採用しません）"],
        missing: options.map((o) => (o.key === "variant" ? `装備条件（${o.values.map((v) => v || "記載なし").join("・")}）` : o.label)),
        // 残る違いが今のバッテリーの品番だけなら、お客様にはラベル写真をお願いする
        ...(options.every((o) => o.key === "currentBattery") ? { photoRequest: true, customerText: PHOTO_TEXT } : {}),
      };
    }
    // 車名・メーカー・原動機型式・仕様が同じで区別できない → 現車確認（ラベル写真）をお願いする
    steps.push("区別できる項目がない → ラベル写真で確認");
    return {
      ...base,
      fitments: live,
      state: "needs_check",
      headline: "現車確認が必要です（行を区別できません）",
      reasons: [
        `車名・メーカー・原動機型式・仕様・純正バッテリーが同じで、回答の異なる行が ${groups.size} 通りあります（年式がないため区別できません）`,
        "お客様に今ついているバッテリーのラベル写真をお願いし、スタッフが確認してください",
      ],
      missing: [],
      photoRequest: true,
      customerText: PHOTO_TEXT,
    };
  }

  const rep = live[0];
  const ids = live.map((r) => r.id);
  const reply = truthy(rep.customer_reply_allowed) && rep.status === "承認済み";
  if (!reply) {
    steps.push(`${rep.status}・自動回答不可 → 適合品は返さず、表示文（ラベル写真のお願い）を表示`);
    return {
      ...base,
      fitments: live,
      state: "needs_check",
      headline: "現車確認待ちの車です（ラベル写真の受付）",
      reasons: ["DBJ 様の判定で「現車確認待ち」のため、適合品を自動で返しません", "お客様から届いたラベル写真で、スタッフが品番を確認して回答してください"],
      missing: [],
      photoRequest: true,
      customerText: rep.display_text || PHOTO_TEXT,
    };
  }

  const product = isProduct(rep.judgment);
  const parts = product ? splitProductCode(rep.dbj_product_code) : [];
  const qty = Number(rep.quantity) || 1;
  const sameCar = new Set(live.map((r) => r.car_name ?? "")).size === 1;
  const car = [sameCar ? rep.car_name : "", by === "model" ? `型式 ${norm}` : ""].filter(Boolean).join("／") || rep.car_name;
  const codeLine = product ? `適合品番：${rep.dbj_product_code}${qty > 1 && parts.length === 1 ? `（${qty}個）` : ""}` : "";
  const template = [
    product ? `お問い合わせのお車（${car}）に適合する弊社バッテリーは次のとおりです。` : `お問い合わせのお車（${car}）について`,
    codeLine,
    product && rep.battery_position ? `搭載位置：${rep.battery_position}` : "",
    rep.display_text,
    rep.display_note ? `※${rep.display_note}` : "",
  ].filter(Boolean).join("\n");
  steps.push(`該当 ${live.length} 行（ID ${ids.slice(0, 10).join(", ")}${ids.length > 10 ? " ほか" : ""}）の回答が同じ → DBJ判定「${rep.judgment}」・自動回答可`);
  return {
    ...base,
    fitments: live,
    state: "confirmed",
    headline: HEADLINE[rep.judgment] ?? "DBJ 判定済みの回答があります",
    reasons: [],
    missing: [],
    judgment: rep.judgment,
    answer: {
      parts: parts.flatMap((p) =>
        p.codes.map((c, i) => ({ role: p.slot ?? (p.codes.length > 1 ? `候補 ${i + 1}` : "適合品番"), part_no: c, qty: p.slot ? 1 : qty })),
      ),
      template,
      notice: rep.display_text,
      subNotice: rep.display_note ?? undefined,
      position: rep.battery_position ?? undefined,
      conditions: [
        `DBJ判定: ${rep.judgment}`,
        ...(rep.required_battery_code ? [`純正バッテリー: ${rep.required_battery_code}${rep.battery_type_spec ? `（${rep.battery_type_spec}）` : ""}`] : []),
        ...(rep.battery_position ? [`搭載位置: ${rep.battery_position}`] : []),
        ...(rep.quantity ? [`個数: ${rep.quantity}`] : []),
        ...(rep.variant ? [`仕様: ${rep.variant}`] : []),
        `承認: ${rep.approved_by ?? "—"}（${rep.approved_at ?? "日付なし"}）`,
        ...(live.length > 1 ? [`同じ回答の行 ${live.length} 件に共通`] : []),
      ],
    },
  };
}
