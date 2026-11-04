"use client";

import { useState } from "react";
import { Search, ShieldAlert } from "lucide-react";
import { partKey } from "@/lib/normalize";
import { DBJ_SAMPLE } from "@/lib/profile";
import { AlertMessage } from "./alert-message";
import { EmptyState } from "./empty-state";
import { ApprovalStatusBadge, Badge, CustomerUseBadge } from "./status-badge";

type MakerCell = { part_no: string; aliases: string; status: string; source: string; replace: string | null };
export type CompareRow = {
  key: string;
  category: string;
  spec_code: string;
  size_group: string;
  battery_type: string;
  spec: { capacity: string; cca: string; dims: string; terminal: string; application: string } | null;
  fitment: string[];
  makers: Record<string, MakerCell[]>;
  own: { part_no: string; status: string; customer_use: boolean; direction: string; conditions: string }[];
  notes: string[];
  sources: string[];
};

const TYPE_TONE = { 通常: "neutral", EFB: "info", AGM: "navy" } as const;

export function ComparisonTable({ rows, makers, categories }: { rows: CompareRow[]; makers: string[]; categories: string[] }) {
  const [tab, setTab] = useState(categories[0]);
  const [q, setQ] = useState("");
  const key = partKey(q);

  // 入力品番の位置付け（どのメーカー・どの規格区分に当たるか）
  const findInput = (r: CompareRow) => {
    if (!key) return null;
    for (const [maker, cells] of Object.entries(r.makers))
      for (const c of cells) if (partKey(c.part_no) === key || c.aliases.split("|").some((a) => partKey(a) === key)) return { maker, part_no: c.part_no };
    if (r.own.some((o) => partKey(o.part_no) === key)) return { maker: "DBJ（自社）", part_no: q.trim().toUpperCase() };
    if (partKey(r.spec_code) === key) return { maker: "規格表記", part_no: r.spec_code };
    return null;
  };
  const located = rows.map((r) => ({ r, hit: findInput(r) })).filter((x) => x.hit);
  const shown = rows.filter((r) => r.category === tab);
  const count = (c: string) => rows.filter((r) => r.category === c).length;

  return (
    <div className="space-y-4">
      <AlertMessage variant="warning" title="横並び表示は相互交換可能の保証ではありません">
        通常品・EFB・AGM はサイズが同じでも互換として扱いません。顧客への回答には、DBJ が承認し顧客回答に利用可とした自社品番のみを使用してください。
      </AlertMessage>

      <div className="card p-4">
        <label htmlFor="cmp-q" className="field-label">
          入力メーカー品番の位置付けを確認
        </label>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative md:w-96">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              id="cmp-q"
              className="field pl-9 font-mono"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                const k = partKey(e.target.value);
                const first = rows.find((r) => {
                  if (!k) return false;
                  return (
                    partKey(r.spec_code) === k ||
                    Object.values(r.makers).flat().some((c) => partKey(c.part_no) === k || c.aliases.split("|").some((a) => partKey(a) === k)) ||
                    r.own.some((o) => partKey(o.part_no) === k)
                  );
                });
                if (first) setTab(first.category);
              }}
              placeholder={DBJ_SAMPLE ? "例: DBJ-M42、Q-85、LN4" : "例: BT-60B24L/CR、TK LN2 AGM、N-55"}
              autoComplete="off"
            />
          </div>
          <div className="text-[13px]" aria-live="polite">
            {q &&
              (located.length === 0 ? (
                <span className="text-bad">一致する品番・規格表記はありません</span>
              ) : (
                located.map(({ r, hit }) => (
                  <div key={r.key} className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted">{hit!.maker}</span>
                    <span className="font-mono font-medium">{hit!.part_no}</span>→<Badge tone="navy">{r.category}</Badge>
                    <span className="font-mono">{r.spec_code}</span>
                    <span className="text-muted">（サイズ {r.size_group}・{r.battery_type}）</span>
                  </div>
                ))
              ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div role="tablist" aria-label="規格区分" className="flex overflow-x-auto border-b border-line px-2">
          {categories.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={tab === c}
              onClick={() => setTab(c)}
              className={`relative flex h-11 shrink-0 items-center gap-1.5 px-4 text-[13px] ${
                tab === c ? "font-bold text-navy" : "text-muted hover:text-ink"
              }`}
            >
              {c}
              <span className={`rounded-full px-1.5 text-[11px] tnum ${tab === c ? "bg-navy-soft text-navy" : "bg-line-soft text-muted"}`}>{count(c)}</span>
              {tab === c && <span className="absolute right-3 bottom-0 left-3 h-0.5 rounded bg-navy" aria-hidden />}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <EmptyState title={`${tab} の登録はありません`} compact />
        ) : (
          <div className="overflow-x-auto" role="tabpanel">
            <table className="dt min-w-[1280px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-[3] w-[84px] min-w-[84px]">規格区分</th>
                  <th className="sticky left-[84px] z-[3] w-[112px] min-w-[112px] border-r border-line shadow-[4px_0_6px_-4px_rgb(15_23_42/0.08)]">
                    サイズ
                  </th>
                  <th>電池種別</th>
                  <th>必要仕様</th>
                  <th>入力メーカー・品番</th>
                  {makers.map((m) => (
                    <th key={m}>{m}</th>
                  ))}
                  <th className="bg-navy-soft! text-navy!">DBJ 自社品番</th>
                  <th>確認状態</th>
                  <th>注意事項・出典</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const hit = findInput(r);
                  const rowBg = hit ? "bg-warn-soft!" : "";
                  return (
                    <tr key={r.key}>
                      <td className={`sticky left-0 z-[1] w-[84px] min-w-[84px] bg-surface ${rowBg}`}>
                        <span className="text-xs text-muted">{r.category}</span>
                      </td>
                      <td
                        className={`sticky left-[84px] z-[1] w-[112px] min-w-[112px] border-r border-line bg-surface shadow-[4px_0_6px_-4px_rgb(15_23_42/0.08)] ${rowBg}`}
                      >
                        <div className="font-mono font-bold text-ink">{r.spec_code}</div>
                        <div className="text-xs text-muted">サイズ {r.size_group}</div>
                      </td>
                      <td className={rowBg}>
                        <Badge tone={TYPE_TONE[r.battery_type as keyof typeof TYPE_TONE] ?? "neutral"}>{r.battery_type}</Badge>
                      </td>
                      <td className={`min-w-[170px] text-xs tnum ${rowBg}`}>
                        {r.spec ? (
                          <>
                            <div>
                              {r.spec.capacity}・{r.spec.cca}
                            </div>
                            <div className="text-muted">
                              {r.spec.dims}mm・端子{r.spec.terminal}
                            </div>
                            {r.spec.application && <div className="text-muted">{r.spec.application}</div>}
                          </>
                        ) : (
                          <span className="text-muted">仕様未登録</span>
                        )}
                        {r.fitment.length > 0 && (
                          <div className="mt-1.5 border-t border-line-soft pt-1.5 text-[11px] text-muted">
                            新車搭載: {r.fitment.join("、")}
                          </div>
                        )}
                      </td>
                      <td className={`min-w-[130px] text-xs ${rowBg}`}>
                        {hit ? (
                          <>
                            <div className="text-muted">{hit.maker}</div>
                            <div className="font-mono font-medium">{hit.part_no}</div>
                          </>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
                      </td>
                      {makers.map((m) => (
                        <td key={m} className={`min-w-[130px] text-xs ${rowBg}`}>
                          {r.makers[m]?.length ? (
                            r.makers[m].map((c) => (
                              <div key={c.part_no} className="mb-1 last:mb-0" title={`出典: ${c.source}`}>
                                <div className="font-mono font-medium whitespace-nowrap text-ink">{c.part_no}</div>
                                {c.aliases && <div className="text-[11px] text-muted">旧: {c.aliases.split("|").join("、")}</div>}
                                {c.status !== "解析済み" && <ApprovalStatusBadge status={c.status} />}
                              </div>
                            ))
                          ) : (
                            <span className="text-subtle">—</span>
                          )}
                        </td>
                      ))}
                      <td className={`min-w-[150px] bg-navy-soft/40 ${rowBg}`}>
                        {r.own.length ? (
                          r.own.map((o) => (
                            <div key={o.part_no}>
                              <div className="font-mono text-[13px] font-bold whitespace-nowrap text-navy">{o.part_no}</div>
                              <div className="text-[11px] text-muted">
                                {o.direction}
                                {o.conditions ? `・${o.conditions}` : ""}
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-bad">取扱なし</span>
                        )}
                      </td>
                      <td className={rowBg}>
                        {r.own.map((o) => (
                          <div key={o.part_no} className="flex flex-col items-start gap-1">
                            <ApprovalStatusBadge status={o.status} />
                            <CustomerUseBadge allowed={o.customer_use} />
                          </div>
                        ))}
                        {!r.own.length && <span className="text-xs text-subtle">—</span>}
                      </td>
                      <td className={`min-w-[200px] text-xs ${rowBg}`}>
                        {r.notes.length > 0 && (
                          <div className="flex gap-1 text-warn-ink">
                            <ShieldAlert size={13} className="mt-0.5 shrink-0" aria-hidden />
                            {r.notes.join(" / ")}
                          </div>
                        )}
                        <div className="text-muted">出典: {r.sources.join("、") || "—"}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-muted">※ 表示しているメーカー名・品番はすべて架空の検証データです。他社品番の詳細比較は社内用です。</p>
    </div>
  );
}
