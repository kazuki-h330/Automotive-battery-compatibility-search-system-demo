// 共通判定処理（Phase 1）。社内検索・LINE 受付・OCR・自動返信はすべてこの関数を呼ぶ。
// 生成 AI は使わず、承認済みマスターとルールのみで判定する。DB アクセスを持たない純粋関数。

import { isMonth, normModel, parseSpec, partKey, splitList, withoutPrefix, type ParsedSpec } from "./normalize";
import type { Row } from "./db";

export type State = "confirmed" | "needs_check" | "not_found";

export type MasterData = {
  vehicles: Row[];
  batteries: Row[];
  mappings: Row[];
  sources: Row[];
  ownProducts: Row[];
  products: Row[];
};

export type VehicleQuery = {
  maker?: string;
  modelCode: string;
  regYm?: string; // 初度登録年月 'YYYY-MM'
  engineCode?: string;
  conditions?: string[] | null; // null = 未回答。[] = 該当なし（標準）
};

export type MappingView = {
  id: string;
  own_part_no: string;
  own_name?: string;
  status: string;
  customer_use: boolean;
  source_name?: string;
  source_customer_use: boolean;
  direction: string;
  conditions?: string;
  note?: string;
};

export type BatteryView = Row & { mappings: MappingView[]; source_name?: string };
export type CandidateView = Row & {
  batteries: BatteryView[];
  excluded?: string;
  period_comparable: boolean;
  source_name?: string;
};

export type JudgeResult = {
  kind: "vehicle" | "product";
  state: State;
  headline: string;
  reasons: string[];
  missing: string[];
  hints: string[];
  candidates: CandidateView[];
  answer?: { parts: { role: string; part_no: string; name?: string; qty: number }[]; template: string; conditions?: string[] };
  internalParts: { role: string; part_no: string; status: string; customer_use: boolean }[];
  trace: { input: unknown; normalized: string; steps: string[] };
  product?: ProductResultExtra;
};

const sourceOf = (d: MasterData, id: string) => d.sources.find((s) => s.id === id);
const truthy = (v: unknown) => v === true || v === "true" || v === "t";

function mappingView(d: MasterData, m: Row): MappingView {
  const src = sourceOf(d, m.source_id);
  return {
    id: m.id,
    own_part_no: m.own_part_no,
    own_name: d.ownProducts.find((o) => o.part_no === m.own_part_no)?.name,
    status: m.status,
    customer_use: truthy(m.customer_use),
    source_name: src?.name,
    source_customer_use: truthy(src?.customer_use),
    direction: m.direction,
    conditions: m.conditions ?? undefined,
    note: m.note ?? undefined,
  };
}

function inPeriod(ym: string, from?: string | null, to?: string | null) {
  return (!from || ym >= from) && (!to || ym <= to);
}

const fmtPeriod = (v: Row) =>
  `${v.period_basis}: ${v.period_from ?? "不明"}～${v.period_to ?? ""}（原文: ${v.period_raw ?? "なし"}）`;

const batteryLabel = (b: Row) => `${b.role} ${b.category} ${b.spec_code}${b.qty > 1 ? ` ×${b.qty}` : ""}`;

export function judgeVehicle(q: VehicleQuery, d: MasterData): JudgeResult {
  const norm = normModel(q.modelCode);
  const steps: string[] = [`型式を正規化: 「${q.modelCode}」→「${norm}」（接頭辞は削除しない）`];
  const base = { kind: "vehicle" as const, trace: { input: q, normalized: norm, steps } };

  const all = d.vehicles.filter((v) => normModel(v.model_code) === norm);
  if (all.length === 0) {
    const hints = [
      ...new Set(
        d.vehicles
          .filter((v) => norm && withoutPrefix(v.model_code) === withoutPrefix(norm) && normModel(v.model_code) !== norm)
          .map((v) => `接頭辞違いの登録あり: ${v.model_code}（${v.car_name}）— 自動では採用しません。車検証の型式を再確認してください`),
      ),
    ];
    steps.push("一致する型式なし");
    // バッテリーの品番・規格表記が入力された場合は検索画面を案内する（判定には使わない）
    const key = partKey(q.modelCode);
    const isBattery =
      d.ownProducts.some((o) => partKey(o.part_no) === key) ||
      d.products.some((p) => partKey(p.part_no) === key || splitList(p.aliases).some((a) => partKey(a) === key)) ||
      !!parseSpec(q.modelCode);
    if (isBattery) hints.push(`「${q.modelCode}」はバッテリーの品番または規格表記のようです。「バッテリー品番検索」で検索してください`);
    return {
      ...base,
      state: "not_found",
      headline: "該当する車両データが未登録です",
      reasons: ["入力された型式に一致する車両データがありません"],
      missing: [],
      hints,
      candidates: [],
      internalParts: [],
    };
  }
  steps.push(`型式一致: ${all.length} 件`);

  const cands: CandidateView[] = all.map((v) => ({
    ...v,
    source_name: sourceOf(d, v.source_id)?.name,
    period_comparable: v.period_basis === "初度登録" && isMonth(v.period_from) && (!v.period_to || isMonth(v.period_to)),
    batteries: d.batteries
      .filter((b) => b.vehicle_id === v.id)
      .map((b) => ({
        ...b,
        source_name: sourceOf(d, b.source_id)?.name,
        mappings: d.mappings
          .filter((m) => m.match_type === "spec" && m.category === b.category && m.spec_code === b.spec_code)
          .map((m) => mappingView(d, m)),
      })),
  }));

  if (q.maker) {
    for (const c of cands) if (c.maker !== q.maker) c.excluded = `車両メーカーが異なる（${c.maker}）`;
    steps.push(`車両メーカー「${q.maker}」で絞り込み`);
  }

  // 原動機型式による絞り込み（未登録の車両は除外しない）
  const eng = normModel(q.engineCode);
  if (eng) {
    for (const c of cands)
      if (!c.excluded && c.engine_code && normModel(c.engine_code) !== eng) c.excluded = `原動機型式が異なる（${c.engine_code}）`;
    steps.push(`原動機型式「${eng}」で絞り込み`);
  }

  // 初度登録年月による絞り込み（基準が「初度登録」かつ月精度のデータのみ比較）
  const reasons: string[] = [];
  if (q.regYm) {
    if (!isMonth(q.regYm)) reasons.push("初度登録年月は YYYY-MM 形式で入力してください");
    else
      for (const c of cands) {
        if (c.excluded) continue;
        if (c.period_comparable) {
          if (!inPeriod(q.regYm, c.period_from, c.period_to)) c.excluded = `初度登録年月が適用期間外（${fmtPeriod(c)}）`;
        } else {
          reasons.push(`${c.car_name}: 期間データが「${c.period_basis}」基準または年のみのため、初度登録年月と比較できません（${c.period_raw ?? "原文なし"}）`);
        }
      }
    steps.push(`初度登録年月「${q.regYm}」で絞り込み（販売・製造時期とは比較しない）`);
  }

  // 装備条件による絞り込み
  if (q.conditions) {
    const sel = new Set(q.conditions);
    for (const c of cands) {
      if (c.excluded) continue;
      const need = splitList(c.conditions);
      if (!need.every((x) => sel.has(x))) c.excluded = `装備条件が一致しない（${need.join("・")}）`;
    }
    const remain = cands.filter((c) => !c.excluded);
    const maxSpecific = Math.max(0, ...remain.map((c) => splitList(c.conditions).length));
    for (const c of remain)
      if (splitList(c.conditions).length < maxSpecific) c.excluded = "より条件の一致する仕様があるため除外";
    steps.push(`装備条件「${q.conditions.length ? q.conditions.join("・") : "該当なし（標準）"}」で絞り込み`);
  }

  const live = cands.filter((c) => !c.excluded);
  if (live.length === 0) {
    return {
      ...base,
      state: "not_found",
      headline: "入力条件に一致する車両データがありません",
      reasons: ["型式は登録されていますが、入力された条件に一致する仕様がありません。条件を確認してください"],
      missing: [],
      hints: [],
      candidates: cands,
      internalParts: [],
    };
  }

  // 要件の組合せごとにまとめる（データは統合せず、比較のためのキーのみ）
  const sig = (c: CandidateView) =>
    c.batteries.map((b) => `${b.role}|${b.category}|${b.spec_code}|${b.qty}`).sort().join(";");
  const sigs = new Set(live.map(sig));
  const missing: string[] = [];
  if (sigs.size > 1) {
    const differs = (f: (c: CandidateView) => string) => new Set(live.map(f)).size > 1;
    if (!q.regYm && differs((c) => `${c.period_from}-${c.period_to}`)) missing.push("初度登録年月");
    if (!q.conditions && differs((c) => c.conditions ?? "")) {
      const opts = [...new Set(live.flatMap((c) => splitList(c.conditions)))];
      missing.push(`装備条件（${opts.join("・")} の有無）`);
    }
    if (!eng && differs((c) => c.engine_code ?? "")) missing.push("原動機型式");
    steps.push(`バッテリー要件が ${sigs.size} 通りに分かれる → 自動採用しない`);
    return {
      ...base,
      state: "needs_check",
      headline: "複数の候補があります。条件を追加してください",
      reasons: [
        ...reasons,
        "同じ型式で搭載バッテリーが異なる仕様が存在します（先頭行・多数派は採用しません）",
        ...(missing.length ? [] : ["追加入力で絞り込めないため、スタッフが車両を確認してください"]),
      ],
      missing,
      hints: [],
      candidates: cands,
      internalParts: [],
    };
  }

  // 単一の要件組合せ：承認状態・利用可否を全件確認
  const internalParts: JudgeResult["internalParts"] = [];
  const parts: NonNullable<JudgeResult["answer"]>["parts"] = [];
  let notFound = false;
  for (const c of live) {
    if (c.status !== "適合確認済み") reasons.push(`車両データが「${c.status}」です（適合未確認）`);
    const vs = sourceOf(d, c.source_id);
    if (!truthy(vs?.customer_use)) reasons.push(`車両データの出典「${vs?.name}」は顧客回答に利用できません`);
    if (c.batteries.length === 0) reasons.push("搭載バッテリー要件が未登録です");
    // 候補が 1 件でも未承認なら確定しない（先頭行だけで判断しない）
    for (const b of c.batteries) {
      const label = batteryLabel(b);
      const add = (r: string) => {
        if (!reasons.includes(r)) reasons.push(r);
      };
      if (b.status !== "適合確認済み") add(`${label}: 搭載要件が「${b.status}」です`);
      const bs = sourceOf(d, b.source_id);
      if (!truthy(bs?.customer_use)) add(`${label}: 要件の出典「${bs?.name}」は顧客回答に利用できません`);
      if (b.condition) {
        steps.push(`${label}: 条件「${b.condition}」付きの要件`);
        const met = new Set([...splitList(c.conditions), ...(q.conditions ?? [])]);
        if (!splitList(b.condition).every((x) => met.has(x))) add(`${label}: 「${b.condition}」の場合の要件です。該当するか確認してください`);
      }
    }
  }
  const rep = live[0];
  for (const b of rep.batteries) {
    const label = batteryLabel(b);
    for (const m of b.mappings)
      internalParts.push({ role: b.role, part_no: m.own_part_no, status: m.status, customer_use: m.customer_use && m.source_customer_use });
    if (b.mappings.length === 0) {
      reasons.push(`${label}: 自社対応品番が未登録です`);
      notFound = true;
      continue;
    }
    if (b.mappings.length > 1) {
      reasons.push(`${label}: 自社候補が ${b.mappings.length} 件あります（自動では選びません）`);
      continue;
    }
    const m = b.mappings[0];
    if (m.status !== "自社対応確認済み") reasons.push(`${label}: 自社対応「${m.own_part_no}」は未承認です`);
    else if (!m.customer_use || !m.source_customer_use)
      reasons.push(`${label}: 自社対応「${m.own_part_no}」は顧客回答に利用不可（出典: ${m.source_name}）。社内参考のみ`);
    parts.push({ role: b.role, part_no: m.own_part_no, name: m.own_name, qty: Number(b.qty) || 1 });
  }

  if (notFound && reasons.every((r) => r.includes("未登録"))) {
    return {
      ...base,
      state: "not_found",
      headline: "自社対応品番が未登録です",
      reasons,
      missing: [],
      hints: [],
      candidates: cands,
      internalParts,
    };
  }
  if (reasons.length) {
    steps.push("確認要の理由あり → 適合確定にしない");
    return {
      ...base,
      state: "needs_check",
      headline: "スタッフ確認が必要です",
      reasons,
      missing,
      hints: [],
      candidates: cands,
      internalParts,
    };
  }

  steps.push("全項目確認済み・承認済み・顧客回答利用可 → 回答可");
  const lines = parts.map(
    (p) => `${p.role === "補機" ? "補機用" : "メイン"}バッテリー：「${p.part_no}」${p.qty > 1 ? `×${p.qty}個（同時搭載）` : ""}`,
  );
  const template = [
    `お問い合わせいただいたお車（${rep.car_name}／型式 ${rep.model_code}）に適合する弊社バッテリーは以下のとおりです。`,
    ...lines,
    "※交換前に、現在搭載されているバッテリーの表記・端子位置をご確認ください。",
  ].join("\n");
  const conditions = [
    `適用期間: ${fmtPeriod(rep)}`,
    ...(rep.conditions ? [`装備条件: ${splitList(rep.conditions).join("・")}`] : []),
    ...(rep.engine_code ? [`原動機型式: ${rep.engine_code}`] : []),
    ...rep.batteries.map((b) => `搭載要件（${b.role}）: ${b.category} ${b.spec_code}${b.qty > 1 ? ` ×${b.qty}個` : ""}${b.condition ? `（条件: ${b.condition}）` : ""}`),
    ...rep.batteries.flatMap((b) => b.mappings.filter((m) => m.conditions).map((m) => `対応条件（${m.own_part_no}）: ${m.conditions}`)),
    ...(live.length > 1 ? [`同一要件の仕様 ${live.length} 件に共通`] : []),
  ];
  return {
    ...base,
    state: "confirmed",
    headline: "確認済みの回答用品番があります",
    reasons: [],
    missing: [],
    hints: [],
    candidates: cands,
    answer: { parts, template, conditions },
    internalParts,
  };
}

// ---------------- バッテリー品番検索（現物品番・規格表記 → 自社品番の置換） ----------------

export type BatteryType = "通常" | "EFB" | "AGM";
export const BATTERY_TYPES: BatteryType[] = ["通常", "EFB", "AGM"];

/** 規格区分から電池種別を取り出す（例: "LN AGM" → AGM） */
export function typeOf(category: string): BatteryType {
  return category.includes("AGM") ? "AGM" : category.includes("EFB") ? "EFB" : "通常";
}

export type ProductQuery = {
  maker?: string;
  partNo?: string; // 現物品番（商品コード）
  spec?: string; // 規格表記
  batteryType?: BatteryType;
};

export type ProductResultExtra = {
  matchedBy: "part_no" | "alias" | "own" | "spec" | "none";
  products: (Row & { mappings: MappingView[]; source_name?: string })[];
  spec?: { category?: string; spec_code: string };
  sameSpec: Row[];
  specMappings: MappingView[];
  ownProduct?: Row;
};

/** 規格表記の種類と電池種別から規格区分を決める。決められなければ理由を返す */
function resolveCategory(spec: ParsedSpec, type?: BatteryType): { category?: string; missing?: string; error?: string } {
  if (spec.kind === "ISS") {
    if (type && type !== "EFB") return { error: `${spec.spec_code} はアイドリングストップ車用（EFB）の規格表記です。電池種別「${type}」と一致しません` };
    return { category: "JIS EFB" };
  }
  if (spec.kind === "JIS") {
    if (type === "AGM") return { error: "JIS 規格の AGM は比較対象区分にありません" };
    return { category: type === "EFB" ? "JIS EFB" : "JIS" };
  }
  const hinted = spec.categoryHint ? typeOf(spec.categoryHint) : undefined;
  const t = type ?? hinted;
  if (!t) return { missing: "電池種別（通常 / EFB / AGM）" };
  if (hinted && type && hinted !== type) return { error: `規格表記の種別（${hinted}）と電池種別（${type}）が一致しません` };
  return { category: t === "通常" ? "LN" : `LN ${t}` };
}

/** 入力された規格表記・電池種別が品番の仕様と一致するか（不一致なら確定しない） */
function inputMismatch(q: ProductQuery, specIn: string, part: Row, partNo: string) {
  const reasons: string[] = [];
  if (specIn) {
    const ps = parseSpec(specIn);
    if (!ps || ps.spec_code !== part.spec_code)
      reasons.push(`入力された規格表記「${specIn}」と、品番 ${partNo} の規格（${part.spec_code}）が一致しません`);
  }
  if (q.batteryType && typeOf(part.category) !== q.batteryType)
    reasons.push(`入力された電池種別「${q.batteryType}」と、品番 ${partNo} の種別（${typeOf(part.category)}）が一致しません`);
  return reasons;
}

export function judgeProduct(q: ProductQuery, d: MasterData): JudgeResult {
  const partIn = (q.partNo ?? "").trim();
  const specIn = (q.spec ?? "").trim();
  const key = partKey(partIn);
  const steps: string[] = [];
  const base = {
    kind: "product" as const,
    trace: { input: q, normalized: [key, specIn].filter(Boolean).join(" / "), steps },
    candidates: [],
    internalParts: [],
  };
  const extra: ProductResultExtra = { matchedBy: "none", products: [], sameSpec: [], specMappings: [] };
  if (partIn) steps.push(`現物品番を正規化: 「${partIn}」→「${key}」（原表記は保持）`);

  // 1) 自社品番そのもの
  const own = key ? d.ownProducts.find((o) => partKey(o.part_no) === key) : undefined;
  if (own) {
    extra.matchedBy = "own";
    extra.ownProduct = own;
    steps.push("自社品番に一致");
    const reasons = inputMismatch(q, specIn, own, own.part_no);
    if (reasons.length)
      return { ...base, state: "needs_check", headline: "入力内容が一致しません", reasons, missing: [], hints: [], product: extra };
    return {
      ...base,
      state: "confirmed",
      headline: `自社品番 ${own.part_no} です`,
      reasons: [],
      missing: [],
      hints: [],
      product: extra,
      answer: { parts: [{ role: "商品", part_no: own.part_no, name: own.name, qty: 1 }], template: `弊社品番「${own.part_no}」（${own.name}）です。` },
    };
  }

  // 2) 他社品番・旧品番・別名
  let hits = key ? d.products.filter((p) => partKey(p.part_no) === key || splitList(p.aliases).some((a) => partKey(a) === key)) : [];
  if (q.maker) hits = hits.filter((p) => p.maker === q.maker);
  if (hits.length) {
    extra.matchedBy = hits.some((p) => partKey(p.part_no) === key) ? "part_no" : "alias";
    extra.products = hits.map((p) => ({
      ...p,
      source_name: sourceOf(d, p.source_id)?.name,
      mappings: d.mappings.filter((m) => m.match_type === "product" && m.product_id === p.id).map((m) => mappingView(d, m)),
    }));
    const p0 = hits[0];
    extra.spec = { category: p0.category, spec_code: p0.spec_code };
    extra.sameSpec = d.products.filter((p) => p.spec_code === p0.spec_code && p.size_group === p0.size_group);
    extra.specMappings = d.mappings
      .filter((m) => m.match_type === "spec" && m.category === p0.category && m.spec_code === p0.spec_code)
      .map((m) => mappingView(d, m));
    steps.push(`他社商品に一致: ${hits.map((h) => `${h.maker} ${h.part_no}`).join(", ")}（${extra.matchedBy === "alias" ? "旧品番・別名" : "品番"}）`);

    if (hits.length > 1)
      return {
        ...base,
        state: "needs_check",
        headline: "複数メーカーの品番に一致します",
        reasons: ["同じ表記の品番が複数メーカーに存在します。メーカーを指定してください"],
        missing: ["メーカー名"],
        hints: [],
        product: extra,
      };

    const reasons = inputMismatch(q, specIn, p0, p0.part_no);

    const ms = extra.products[0].mappings;
    if (ms.length === 0) {
      const other = extra.specMappings.length
        ? []
        : d.ownProducts
            .filter((o) => o.size_group === p0.size_group && o.category !== p0.category)
            .map((o) => `同サイズの ${o.part_no}（${o.category}）は電池種別が異なるため互換扱いしません`);
      steps.push("商品対応（置換）の登録なし");
      return {
        ...base,
        state: "not_found",
        headline: "自社の置換対応が未登録です",
        reasons: [
          ...reasons,
          `${p0.maker} ${p0.part_no}（${p0.category} ${p0.spec_code}）に対する自社対応は承認されていません`,
          ...(extra.specMappings.length ? ["同規格の自社品番は横並び表示のみです。置換可否は DBJ の承認が必要です"] : []),
        ],
        missing: [],
        hints: other,
        product: extra,
      };
    }
    if (ms.length > 1) reasons.push(`自社候補が ${ms.length} 件あります（自動では選びません）`);
    const m = ms[0];
    if (m.status !== "自社対応確認済み") reasons.push(`自社対応「${m.own_part_no}」は未承認です${m.note ? `（${m.note}）` : ""}`);
    else if (!m.customer_use || !m.source_customer_use) reasons.push(`自社対応「${m.own_part_no}」は顧客回答に利用不可（出典: ${m.source_name}）。社内参考のみ`);
    if (p0.status !== "解析済み") reasons.push(`他社商品データが「${p0.status}」です（仕様未検証）`);
    if (reasons.length)
      return { ...base, state: "needs_check", headline: "スタッフ確認が必要です", reasons, missing: [], hints: [], product: extra };
    steps.push(`承認済みの置換対応 ${m.id} → ${m.own_part_no}`);
    return {
      ...base,
      state: "confirmed",
      headline: "確認済みの置換品番があります",
      reasons: [],
      missing: [],
      hints: ["これは現物バッテリーからの品番置換です。車両への適合確認は「車両から検索」で行ってください"],
      product: extra,
      answer: {
        parts: [{ role: "置換", part_no: m.own_part_no, name: m.own_name, qty: 1 }],
        template: `お手元のバッテリー（${p0.part_no}）の交換用として、弊社品番「${m.own_part_no}」をご案内いたします。\n※端子位置・固定方法が同一であることをご確認ください。`,
        conditions: [
          `置換元: ${p0.maker} ${p0.part_no}（${p0.category} ${p0.spec_code}）`,
          `置換方向: ${m.direction}`,
          ...(m.conditions ? [`対応条件: ${m.conditions}`] : []),
          `端子: ${p0.terminal ?? "—"}／固定方法: ${p0.hold_down ?? "—"}`,
        ],
      },
    };
  }
  if (partIn) steps.push("品番・旧品番・別名に一致なし");

  // 3) 規格表記（品番欄に規格表記が入力された場合も解析する）
  const specText = specIn || partIn;
  const spec = specText ? parseSpec(specText) : null;
  if (spec) {
    const ignored = partIn && specIn ? [`入力された品番「${partIn}」は未登録のため、規格表記「${specIn}」のみで検索しました`] : [];
    const resolved = resolveCategory(spec, q.batteryType);
    extra.matchedBy = "spec";
    extra.spec = { category: resolved.category, spec_code: spec.spec_code };
    steps.push(`規格表記として解析: ${spec.spec_code}（${resolved.category ?? "規格区分未確定"}）`);
    if (resolved.error)
      return { ...base, state: "needs_check", headline: "入力内容が一致しません", reasons: [...ignored, resolved.error], missing: [], hints: [], product: extra };
    if (!resolved.category) {
      extra.sameSpec = d.products.filter((p) => p.spec_code === spec.spec_code);
      return {
        ...base,
        state: "needs_check",
        headline: "電池種別の指定が必要です",
        reasons: [...ignored, `${spec.spec_code} だけでは通常品・EFB・AGM を判別できません。同サイズでも互換扱いしません`],
        missing: [resolved.missing!],
        hints: [],
        product: extra,
      };
    }
    const category = resolved.category;
    extra.sameSpec = d.products.filter((p) => p.spec_code === spec.spec_code && p.category === category);
    extra.specMappings = d.mappings
      .filter((m) => m.match_type === "spec" && m.category === category && m.spec_code === spec.spec_code)
      .map((m) => mappingView(d, m));
    if (!extra.specMappings.length)
      return {
        ...base,
        state: "not_found",
        headline: "この規格の自社対応がありません",
        reasons: [...ignored, `${category} ${spec.spec_code} に対応する自社品番は登録されていません`],
        missing: [],
        hints: [],
        product: extra,
      };
    const m = extra.specMappings[0];
    const reasons = [...ignored];
    if (extra.specMappings.length > 1) reasons.push("自社候補が複数あります");
    if (m.status !== "自社対応確認済み") reasons.push(`自社対応「${m.own_part_no}」は未承認です`);
    else if (!m.customer_use || !m.source_customer_use) reasons.push(`「${m.own_part_no}」は顧客回答に利用不可（出典: ${m.source_name}）`);
    reasons.push("規格表記のみの入力です。容量・端子位置・高さ・用途を現物で確認してください");
    return { ...base, state: "needs_check", headline: "規格表記からの候補です（現物確認が必要）", reasons, missing: [], hints: [], product: extra };
  }

  steps.push("品番・別名・規格表記のいずれにも一致せず");
  return {
    ...base,
    state: "not_found",
    headline: "該当する品番が未登録です",
    reasons: ["入力された品番・規格表記に一致するデータがありません"],
    missing: [],
    hints: d.vehicles.some((v) => normModel(v.model_code) === normModel(specText)) ? [`「${specText}」は車両の型式です。「車両から検索」で検索してください`] : [],
    product: extra,
  };
}

