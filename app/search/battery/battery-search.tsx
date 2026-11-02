"use client";

import { useState } from "react";
import { BatteryMedium } from "lucide-react";
import { actorPayload, postJson, useActor } from "@/components/actor";
import { AlertMessage } from "@/components/alert-message";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ModeNotice, ResultCard, TraceDetails } from "@/components/result-card";
import { ExampleChips, Field, SearchForm } from "@/components/search-form";
import { ApprovalStatusBadge, Badge, CustomerUseBadge } from "@/components/status-badge";
import { BATTERY_TYPES, typeOf, type BatteryType, type JudgeResult, type MappingView, type ProductQuery } from "@/lib/judge";
import type { Row } from "@/lib/db";

const EXAMPLES: { label: string; q: ProductQuery }[] = [
  { label: "承認済みの置換", q: { partNo: "AL-55B24L" } },
  { label: "旧品番・別名", q: { partNo: "al55b24l-n" } },
  { label: "置換が未承認", q: { partNo: "DG-55B24L-STD" } },
  { label: "顧客回答不可の出典", q: { partNo: "AL-Q85" } },
  { label: "EFB の取扱なし", q: { partNo: "BT-LN2-EFB" } },
  { label: "品番と種別の不一致", q: { partNo: "AL-LN2", batteryType: "AGM" } },
  { label: "規格 LN2（種別なし）", q: { spec: "LN2" } },
  { label: "規格 LN2 × 通常", q: { spec: "LN2", batteryType: "通常" } },
  { label: "規格 55B24L", q: { spec: "55B24L" } },
  { label: "自社品番", q: { partNo: "DBJ-LN2" } },
  { label: "未登録", q: { partNo: "XYZ-123" } },
];

type Res = { result: JudgeResult; versions: Record<string, number> };

export function BatterySearch({ makers }: { makers: string[] }) {
  const { actor } = useActor();
  const [maker, setMaker] = useState("");
  const [partNo, setPartNo] = useState("");
  const [spec, setSpec] = useState("");
  const [batteryType, setBatteryType] = useState<BatteryType | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [res, setRes] = useState<Res | null>(null);

  function clear() {
    setMaker("");
    setPartNo("");
    setSpec("");
    setBatteryType("");
    setRes(null);
    setError("");
    setFieldError("");
  }

  async function run(q?: ProductQuery) {
    const query: ProductQuery = q ?? { maker: maker || undefined, partNo: partNo || undefined, spec: spec || undefined, batteryType: batteryType || undefined };
    if (q) {
      clear();
      setMaker(q.maker ?? "");
      setPartNo(q.partNo ?? "");
      setSpec(q.spec ?? "");
      setBatteryType(q.batteryType ?? "");
    }
    if (!query.partNo?.trim() && !query.spec?.trim()) {
      setFieldError("現物品番または規格表記のどちらかを入力してください");
      return;
    }
    setFieldError("");
    setLoading(true);
    setError("");
    const r = await postJson<Res & { error?: string }>("/api/search/product", { query, actor: actorPayload(actor) });
    setLoading(false);
    if (r.status !== 200) {
      setRes(null);
      return setError(r.data.error ?? "検索処理でエラーが発生しました");
    }
    setRes(r.data);
  }

  const r = res?.result;
  const p = r?.product;
  const needsType = r?.missing.some((m) => m.startsWith("電池種別"));
  const needsMaker = r?.missing.includes("メーカー名");

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(320px,380px)_1fr]">
      <div className="space-y-4 lg:sticky lg:top-24">
        <SearchForm title="検索条件" description="現物品番・規格表記のどちらか一方は必須です" onSubmit={() => run()} onClear={clear} loading={loading}>
          <Field id="bmaker" label="メーカー名" highlight={needsMaker ? "メーカーを指定してください" : undefined}>
            <select id="bmaker" className="field" value={maker} onChange={(e) => setMaker(e.target.value)} aria-invalid={needsMaker}>
              <option value="">指定しない</option>
              {makers.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field id="partno" label="現物品番（商品コード）" hint="旧品番・別名も検索対象です" highlight={fieldError}>
            <input
              id="partno"
              className="field font-mono"
              value={partNo}
              onChange={(e) => setPartNo(e.target.value)}
              placeholder="例: AL-55B24L"
              autoComplete="off"
              aria-invalid={!!fieldError}
            />
          </Field>
          <Field id="spec" label="規格表記" hint="例: 55B24L / N-55 / LN2">
            <input id="spec" className="field font-mono" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="例: LN2" autoComplete="off" />
          </Field>
          <Field id="btype" label="電池種別" highlight={needsType ? "電池種別の指定が必要です" : undefined} hint="LN 系の規格表記では必須">
            <select id="btype" className="field" value={batteryType} onChange={(e) => setBatteryType(e.target.value as BatteryType | "")} aria-invalid={needsType}>
              <option value="">指定しない</option>
              {BATTERY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "通常" ? "通常（液式）" : t}
                </option>
              ))}
            </select>
          </Field>
        </SearchForm>
        <ExampleChips title="検証用の入力例（架空データ）" items={EXAMPLES} onPick={(q) => run(q)} />
      </div>

      <div className="min-w-0 space-y-4">
        <ModeNotice kind="battery" />
        {loading && <LoadingSkeleton />}
        {!loading && error && (
          <AlertMessage variant="error" title="検索エラー">
            {error}。データが未登録という意味ではありません。
          </AlertMessage>
        )}
        {!loading && !error && !r && (
          <div className="card">
            <EmptyState
              icon={BatteryMedium}
              title="品番または規格表記を入力してください"
              description="他社品番の比較情報は社内用です。顧客への回答には、自社品番と必要な案内のみを使用します。"
            />
          </div>
        )}
        {!loading && !error && r && p && (
          <>
            <ResultCard r={r} kindLabel={p.matchedBy === "own" ? "自社品番" : "品番置換"} />
            {p.products.length > 0 && <MatchedProducts rows={p.products} />}
            {(p.sameSpec.length > 0 || p.specMappings.length > 0) && (
              <section className="card overflow-hidden">
                <div className="border-b border-line px-5 py-3.5">
                  <h2 className="text-sm font-bold">
                    同規格の各社品番と自社対応候補
                    {p.spec && (
                      <span className="ml-2 font-normal text-muted">
                        {p.spec.category ?? "区分未確定"} / {p.spec.spec_code}
                      </span>
                    )}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">横並び表示は参考です。相互交換が可能であることを保証するものではありません。</p>
                </div>
                {p.specMappings.length > 0 && (
                  <div className="border-b border-line px-5 py-3">
                    <div className="mb-1.5 text-xs font-medium text-muted">自社対応候補（規格）</div>
                    <MappingList ms={p.specMappings} />
                  </div>
                )}
                <DataTable
                  rows={p.sameSpec}
                  rowKey={(x) => x.id}
                  empty="同規格の他社商品は登録されていません"
                  columns={[
                    { key: "maker", header: "メーカー" },
                    { key: "part_no", header: "商品コード", render: (x) => <span className="font-mono font-medium">{x.part_no}</span> },
                    { key: "category", header: "規格区分", render: (x) => <Badge tone="navy">{x.category}</Badge> },
                    { key: "type", header: "電池種別", render: (x) => typeOf(x.category) },
                    { key: "spec", header: "規格表記", render: (x) => <span className="font-mono">{x.spec_code}</span> },
                    { key: "perf", header: "容量 / CCA", className: "tnum whitespace-nowrap", render: (x) => `${x.capacity_ah ?? "—"}Ah / ${x.cca ?? "—"}` },
                    { key: "application", header: "用途", render: (x) => <span className="text-xs">{x.application ?? "—"}</span> },
                  ]}
                />
              </section>
            )}
            <TraceDetails r={r} versions={res!.versions} />
          </>
        )}
      </div>
    </div>
  );
}

function MatchedProducts({ rows }: { rows: (Row & { mappings: MappingView[]; source_name?: string })[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-bold">該当した商品情報（社内用）</h2>
      </div>
      <DataTable
        rows={rows}
        rowKey={(x) => x.id}
        columns={[
          {
            key: "part",
            header: "メーカー・商品コード",
            render: (x) => (
              <>
                <div className="font-mono font-medium">{x.part_no}</div>
                <div className="text-xs text-muted">{x.maker}</div>
                {x.aliases && <div className="text-xs text-muted">別名: {String(x.aliases).split("|").join("、")}</div>}
              </>
            ),
          },
          {
            key: "spec",
            header: "規格区分・規格表記",
            render: (x) => (
              <div className="whitespace-nowrap">
                <Badge tone="navy">{x.category}</Badge> <span className="font-mono">{x.spec_code}</span>
              </div>
            ),
          },
          {
            key: "perf",
            header: "仕様",
            render: (x) => (
              <div className="text-xs tnum whitespace-nowrap">
                {x.capacity_ah}Ah ／ CCA {x.cca}
                <div className="text-muted">
                  {x.length_mm}×{x.width_mm}×{x.height_mm}mm ／ 端子 {x.terminal}
                </div>
                <div className="text-muted">{x.hold_down}</div>
              </div>
            ),
          },
          { key: "map", header: "自社対応（置換）", render: (x) => <MappingList ms={x.mappings} /> },
          {
            key: "status",
            header: "確認状態・出典",
            render: (x) => (
              <>
                <ApprovalStatusBadge status={x.status} />
                <div className="mt-1 text-xs text-muted">{x.source_name}</div>
              </>
            ),
          },
        ]}
      />
    </section>
  );
}

function MappingList({ ms }: { ms: MappingView[] }) {
  if (!ms.length) return <span className="text-xs text-bad">自社対応なし</span>;
  return (
    <div className="space-y-1.5">
      {ms.map((m) => (
        <div key={m.id}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[13px] font-bold text-navy">{m.own_part_no}</span>
            <ApprovalStatusBadge status={m.status} />
            <CustomerUseBadge allowed={m.customer_use && m.source_customer_use} />
          </div>
          <div className="text-xs text-muted">
            {m.direction}
            {m.conditions ? `・${m.conditions}` : ""}
            {m.note ? `・${m.note}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
