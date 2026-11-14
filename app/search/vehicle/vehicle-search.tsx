"use client";

import { useEffect, useState } from "react";
import { Car } from "lucide-react";
import { actorPayload, postJson, useActor } from "@/components/actor";
import { AlertMessage } from "@/components/alert-message";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ModeNotice, ResultCard, TraceDetails } from "@/components/result-card";
import { ExampleChips, Field, SearchForm } from "@/components/search-form";
import { ApprovalStatusBadge, Badge, CustomerUseBadge } from "@/components/status-badge";
import type { CandidateView, JudgeResult, VehicleQuery } from "@/lib/judge";
import type { FitmentOption } from "@/lib/fitment";
import type { Row } from "@/lib/db";
import { DBJ_SAMPLE } from "@/lib/profile";

const EXAMPLES: { label: string; q: VehicleQuery }[] = DBJ_SAMPLE ? [
  { label: "ID1 通常適合", q: { modelCode: "DBA-NSP130", regYm: "2015-04" } },
  { label: "ID2 年式分岐", q: { modelCode: "DBA-NSP130", regYm: "2019-05" } },
  { label: "ID1/2 年月なし", q: { modelCode: "DBA-NSP130" } },
  { label: "ID4 通常適合", q: { modelCode: "DBA-GK3", regYm: "2016-03" } },
  { label: "ID5 条件不足", q: { modelCode: "DBA-GK3", regYm: "2019-01" } },
  { label: "ID6 同一製品", q: { modelCode: "DBA-E12" } },
  { label: "ID9 LN EFB", q: { modelCode: "DBA-GT7" } },
  { label: "ID14 回答不可", q: { modelCode: "3DA-205004" } },
  { label: "ID15 未登録", q: { modelCode: "TEST-US-001" } },
  { label: "接頭辞なしの入力", q: { modelCode: "NSP130" } },
  { label: "CSVにない型式", q: { modelCode: "DBA-ZZ999" } },
] : [
  { label: "確認済み（一意）", q: { modelCode: "3BA-AB10" } },
  { label: "装備条件で分岐", q: { modelCode: "5BA-CD20" } },
  { label: "期間で分岐", q: { modelCode: "DBA-EF30" } },
  { label: "期間境界 2018-01", q: { modelCode: "DBA-EF30", regYm: "2018-01" } },
  { label: "補機（ハイブリッド）", q: { modelCode: "6AA-GH40" } },
  { label: "2個 同時搭載", q: { modelCode: "QDF-PR80" } },
  { label: "自社対応 未承認", q: { modelCode: "3BA-JK50" } },
  { label: "顧客回答不可の出典", q: { modelCode: "5AA-LM60" } },
  { label: "年のみ・販売基準", q: { modelCode: "DBA-NP70", regYm: "2017-03" } },
  { label: "収集済み（未確認）", q: { modelCode: "5BA-ST90" } },
  { label: "接頭辞なしの入力", q: { modelCode: "AB10" } },
  { label: "未登録", q: { modelCode: "ZZZ-999" } },
];

type CondMode = "unset" | "none" | "some";
type Res = { result: JudgeResult; versions: Record<string, number> };

export function VehicleSearch({ makers, conditions, initialModel, initialReg }: { makers: string[]; conditions: string[]; initialModel?: string; initialReg?: string }) {
  const { actor } = useActor();
  // ダッシュボードのクイック検索から遷移した場合は即時に検索する
  useEffect(() => {
    if (initialModel) run({ modelCode: initialModel, regYm: initialReg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialModel, initialReg]);
  const [maker, setMaker] = useState("");
  const [modelCode, setModelCode] = useState("");
  const [regYm, setRegYm] = useState("");
  const [engineCode, setEngineCode] = useState("");
  const [condMode, setCondMode] = useState<CondMode>("unset");
  const [conds, setConds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [res, setRes] = useState<Res | null>(null);
  const [last, setLast] = useState<VehicleQuery | null>(null);

  function clear() {
    setMaker("");
    setModelCode("");
    setRegYm("");
    setEngineCode("");
    setCondMode("unset");
    setConds([]);
    setRes(null);
    setError("");
    setFieldError("");
  }

  async function run(q?: VehicleQuery) {
    const query: VehicleQuery = q ?? {
      maker: maker || undefined,
      modelCode,
      regYm: regYm || undefined,
      engineCode: engineCode || undefined,
      conditions: condMode === "unset" ? null : condMode === "none" ? [] : conds,
    };
    if (q) {
      clear();
      setModelCode(q.modelCode);
      setRegYm(q.regYm ?? "");
    }
    if (!query.modelCode.trim()) {
      setFieldError("車両型式を入力してください");
      return;
    }
    setFieldError("");
    await exec(query);
  }

  /** DBJ 適合データで回答が分かれた場合：選んだ条件を加えて再検索する */
  function refine(key: FitmentOption["key"], value: string) {
    if (!last) return;
    const q: VehicleQuery = { ...last };
    if (key === "variant") q.conditions = [value || "記載なし"];
    else if (key === "maker") (q.maker = value), setMaker(value);
    else if (key === "engineCode") (q.engineCode = value), setEngineCode(value);
    else if (key === "currentBattery") q.currentBattery = value;
    else q.carName = value;
    exec(q);
  }

  async function exec(query: VehicleQuery) {
    setLast(query);
    setLoading(true);
    setError("");
    const r = await postJson<Res & { error?: string }>("/api/search/vehicle", { query, actor: actorPayload(actor) });
    setLoading(false);
    if (r.status !== 200) {
      setRes(null);
      return setError(r.data.error ?? "検索処理でエラーが発生しました");
    }
    setRes(r.data);
  }

  const missing = (k: string) => res?.result.missing.find((m) => m.startsWith(k));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(320px,380px)_1fr]">
      <div className="space-y-4 lg:sticky lg:top-24">
        <SearchForm title="検索条件" description="車検証の記載どおりに入力してください" onSubmit={() => run()} onClear={clear} loading={loading}>
          <Field id="maker" label="車両メーカー">
            <select id="maker" className="field" value={maker} onChange={(e) => setMaker(e.target.value)}>
              <option value="">指定しない</option>
              {makers.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field id="model" label="車両型式" required hint="接頭辞（例: 3BA-）を含めて入力。全角も可" highlight={fieldError}>
            <input
              id="model"
              className="field font-mono tracking-wide"
              value={modelCode}
              onChange={(e) => setModelCode(e.target.value)}
              placeholder={DBJ_SAMPLE ? "例: DBA-NSP130" : "例: 3BA-AB10"}
              aria-invalid={!!fieldError}
              autoComplete="off"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="reg" label="初度登録年月" highlight={missing("初度登録年月") ? "入力が必要です" : undefined}>
              <input id="reg" type="month" className="field tnum" value={regYm} onChange={(e) => setRegYm(e.target.value)} aria-invalid={!!missing("初度登録年月")} />
            </Field>
            <Field id="engine" label="原動機型式" highlight={missing("原動機型式") ? "入力が必要です" : undefined}>
              <input
                id="engine"
                className="field font-mono"
                value={engineCode}
                onChange={(e) => setEngineCode(e.target.value)}
                placeholder={DBJ_SAMPLE ? "例: 1NR-FKE" : "例: R20T"}
                aria-invalid={!!missing("原動機型式")}
                autoComplete="off"
              />
            </Field>
          </div>
          <fieldset aria-invalid={!!missing("装備条件")}>
            <legend className="field-label">
              車両仕様・装備条件 <span className="text-[11px] font-normal text-subtle">任意</span>
            </legend>
            <div
              className={`grid grid-cols-3 overflow-hidden rounded-lg border text-[13px] ${missing("装備条件") ? "border-warn ring-3 ring-warn/15" : "border-line"}`}
              role="radiogroup"
            >
              {(
                [
                  ["unset", "未確認"],
                  ["none", "該当なし"],
                  ["some", "該当あり"],
                ] as const
              ).map(([v, l]) => (
                <label
                  key={v}
                  className={`flex h-9 cursor-pointer items-center justify-center border-r border-line last:border-r-0 has-focus-visible:outline-2 has-focus-visible:outline-brand ${
                    condMode === v ? "bg-charcoal-soft font-medium text-charcoal" : "bg-surface text-ink/80 hover:bg-canvas"
                  }`}
                >
                  <input type="radio" name="cond" className="sr-only" checked={condMode === v} onChange={() => setCondMode(v)} />
                  {l}
                </label>
              ))}
            </div>
            {condMode === "some" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {conditions.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[13px]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
                      checked={conds.includes(c)}
                      onChange={(e) => setConds(e.target.checked ? [...conds, c] : conds.filter((x) => x !== c))}
                    />
                    {c}
                  </label>
                ))}
              </div>
            )}
            {missing("装備条件") ? (
              <p className="mt-1 text-xs font-medium text-warn-ink">{missing("装備条件")}を確認してください</p>
            ) : (
              <p className="mt-1 text-xs text-muted">「未確認」のまま検索すると、仕様で分かれる車両は確定しません</p>
            )}
          </fieldset>
        </SearchForm>
        <ExampleChips title="検証用の入力例（架空データ）" items={EXAMPLES} onPick={(q) => run(q)} />
      </div>

      <div className="min-w-0 space-y-4">
        <ModeNotice kind="vehicle" />
        {loading && <LoadingSkeleton />}
        {!loading && error && (
          <AlertMessage variant="error" title="検索エラー">
            {error}。データが未登録という意味ではありません。時間をおいて再度お試しください。
          </AlertMessage>
        )}
        {!loading && !error && !res && (
          <div className="card">
            <EmptyState
              icon={Car}
              title="検索条件を入力してください"
              description="結果は「確認済み」「条件不足・要確認」「未登録」の 3 つの状態で表示します。確認済みの場合のみ、顧客向けの定型回答文をコピーできます。"
            />
          </div>
        )}
        {!loading && !error && res && (
          <>
            <ResultCard r={res.result} kindLabel={res.result.fitments ? "DBJ 適合データ" : "車両適合"}>
              {res.result.options && res.result.options.length > 0 && <FitmentOptions options={res.result.options} onPick={refine} />}
            </ResultCard>
            {res.result.fitments && res.result.fitments.length > 0 && <FitmentList rows={res.result.fitments} />}
            {res.result.candidates.length > 0 && <CandidateList candidates={res.result.candidates} />}
            <TraceDetails r={res.result} versions={res.versions} />
          </>
        )}
      </div>
    </div>
  );
}

function CandidateList({ candidates }: { candidates: CandidateView[] }) {
  const active = candidates.filter((c) => !c.excluded).length;
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-bold">車両候補と搭載バッテリー要件</h2>
        <span className="text-xs text-muted">
          型式一致 {candidates.length} 件 ／ 条件該当 {active} 件
        </span>
      </div>
      <ul className="divide-y divide-line-soft">
        {candidates.map((c) => (
          <li key={c.id} className={`px-5 py-4 ${c.excluded ? "bg-canvas" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className={c.excluded ? "opacity-60" : ""}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">{c.car_name}</span>
                  <span className="font-mono text-[13px] text-ink/80">{c.model_code}</span>
                  {c.grade_spec && <Badge>{c.grade_spec}</Badge>}
                  {String(c.conditions ?? "")
                    .split("|")
                    .filter(Boolean)
                    .map((x) => (
                      <Badge key={x} tone="charcoal">
                        {x}
                      </Badge>
                    ))}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                  <span>{c.maker}</span>
                  <span>原動機 {c.engine_code ?? "—"}</span>
                  {(c.type_specification_no || c.classification_no) && (
                    <span className="tnum">
                      型式指定 {c.type_specification_no ?? "—"}・類別 {c.classification_no ?? "—"}
                    </span>
                  )}
                  <span className="tnum">
                    {c.period_basis}基準 {c.period_from ?? "?"}～{c.period_to ?? ""}
                    {!c.period_comparable && <span className="ml-1 text-warn-ink">（初度登録年月と比較不可）</span>}
                  </span>
                  <span>原文「{c.period_raw ?? "—"}」</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <ApprovalStatusBadge status={c.status} />
                <span className="text-[11px] text-muted">{c.source_name}</span>
              </div>
            </div>
            {c.excluded && <div className="mt-2 text-xs text-muted">除外：{c.excluded}</div>}
            {!c.excluded && (
              <div className="mt-3 overflow-x-auto">
                <table className="dt">
                  <thead>
                    <tr>
                      <th>用途</th>
                      <th>規格区分・規格表記</th>
                      <th>原文</th>
                      <th>自社対応</th>
                      <th>確認状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.batteries.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-bad">
                          搭載要件が未登録です
                        </td>
                      </tr>
                    )}
                    {c.batteries.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <Badge tone={b.role === "補機" ? "info" : b.role === "未確定" ? "warning" : "neutral"}>{b.role === "未確定" ? "用途未確定" : b.role}</Badge>
                          {b.qty > 1 && <div className="mt-1 text-xs font-medium text-warn-ink">×{b.qty} 同時搭載</div>}
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="text-muted">{b.category}</span> <span className="font-mono font-medium">{b.spec_code}</span>
                          {b.condition && <div className="text-xs text-muted">条件: {b.condition}</div>}
                        </td>
                        <td className="text-xs text-muted">{b.raw_text}</td>
                        <td>
                          {b.note && <div className="mb-1 text-xs text-muted">{b.note}</div>}
                          {b.mappings.length === 0 ? (
                            <span className="text-xs text-bad">自社対応なし</span>
                          ) : (
                            b.mappings.map((m) => (
                              <div key={m.id} className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono font-medium text-charcoal">{m.own_part_no}</span>
                                <ApprovalStatusBadge status={m.status} />
                                <CustomerUseBadge allowed={m.customer_use && m.source_customer_use} />
                              </div>
                            ))
                          )}
                        </td>
                        <td>
                          <ApprovalStatusBadge status={b.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 回答が分かれる場合の条件選択（選ぶと再検索） */
function FitmentOptions({ options, onPick }: { options: FitmentOption[]; onPick: (key: FitmentOption["key"], value: string) => void }) {
  return (
    <div className="space-y-3 border-t border-line px-5 py-4">
      {options.map((o) => (
        <div key={o.key}>
          <div className="mb-1.5 text-[13px] font-bold">{o.label}を選んでください</div>
          <div className="flex flex-wrap gap-2">
            {o.values.map((v) => (
              <button key={v || "-"} type="button" className="btn-secondary btn-sm" onClick={() => onPick(o.key, v)}>
                {v || "記載なし"}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const yes = (v: unknown) => v === true || v === "true" || v === "t";

/** DBJ 適合データの該当行（社内表示。Source_note は折りたたみ） */
function FitmentList({ rows }: { rows: Row[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-bold">DBJ 適合データの該当行</h2>
        <span className="text-xs text-muted">{rows.length} 行{rows.length >= 2000 ? "（上限）" : ""}</span>
      </div>
      <ul className="divide-y divide-line-soft">
        {rows.slice(0, 200).map((r) => (
          <li key={r.id} className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">{r.car_name ?? "（車名なし）"}</span>
                  <span className="font-mono text-[13px] text-ink/80">{r.model_code ?? "型式なし"}</span>
                  {r.variant && <Badge tone="charcoal">{r.variant}</Badge>}
                  <span className="text-[11px] text-muted">ID {r.id}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                  <span>{r.maker}</span>
                  <span>原動機 {r.engine_code ?? "—"}</span>
                  <span>純正 {r.required_battery_code ?? "—"}{r.battery_type_spec ? `（${r.battery_type_spec}）` : ""}</span>
                  <span>搭載位置 {r.battery_position ?? "—"}</span>
                  <span>個数 {r.quantity ?? "—"}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={r.judgment === "C" || r.judgment === "D" ? "neutral" : r.judgment === "現車確認待ち" ? "warning" : "success"}>DBJ判定 {r.judgment}</Badge>
                <CustomerUseBadge allowed={yes(r.customer_reply_allowed) && r.status === "承認済み"} />
              </div>
            </div>
            <div className="mt-2 text-[13px]">
              <span className="text-muted">適合品番 </span>
              <span className="font-mono font-medium text-charcoal">{r.dbj_product_code ?? "—"}</span>
            </div>
            <p className="mt-1 text-[13px] leading-6 text-ink/85">{r.display_text}</p>
            {r.display_note && <p className="text-xs text-muted">{r.display_note}</p>}
            {(r.spec_note || r.source_note) && (
              <details className="mt-1 text-xs leading-6 text-ink/80">
                <summary className="cursor-pointer text-brand">社内情報を表示（お客様には表示しない）</summary>
                {r.spec_note && <p><span className="font-medium">spec_note：</span>{r.spec_note}</p>}
                {r.source_note && <p className="break-all"><span className="font-medium">Source_note：</span>{r.source_note}</p>}
                <p>承認: {r.approved_by ?? "—"}（{r.approved_at ?? "—"}）・状態: {r.status}</p>
              </details>
            )}
          </li>
        ))}
      </ul>
      {rows.length > 200 && <p className="border-t border-line px-5 py-2 text-xs text-muted">先頭 200 行を表示しています。条件を追加して絞り込んでください。</p>}
    </section>
  );
}
