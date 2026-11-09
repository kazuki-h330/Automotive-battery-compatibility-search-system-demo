"use client";

import { useState } from "react";
import type { DiffItem } from "@/lib/csv";
import { getDataset } from "@/lib/datasets";
import { EmptyState } from "./empty-state";
import { Badge } from "./status-badge";

type Summary = { added: number; changed: number; deleted: number; unchanged?: number; total: number };

export function DiffCounts({ s, compact = false }: { s: Summary; compact?: boolean }) {
  const items = [
    { label: "追加", n: s.added, cls: "text-ok" },
    { label: "変更", n: s.changed, cls: "text-brand" },
    { label: "削除", n: s.deleted, cls: s.deleted ? "text-bad" : "text-ink" },
    ...(s.unchanged !== undefined ? [{ label: "変更なし", n: s.unchanged, cls: "text-muted" }] : []),
    { label: "反映後の件数", n: s.total, cls: "text-ink" },
  ];
  if (compact)
    return (
      <span className="inline-flex flex-wrap gap-x-3 gap-y-0.5 text-xs tnum">
        {items.slice(0, 3).map((i) => (
          <span key={i.label}>
            <span className="text-muted">{i.label}</span> <span className={`font-medium ${i.n ? i.cls : "text-subtle"}`}>{i.n}</span>
          </span>
        ))}
      </span>
    );
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg border border-line bg-surface px-3 py-2">
          <dt className="text-[11px] text-muted">{i.label}</dt>
          <dd className={`text-lg font-bold tnum ${i.cls}`}>{i.n}</dd>
        </div>
      ))}
    </dl>
  );
}

const OP = {
  add: { label: "追加", tone: "success" as const },
  change: { label: "変更", tone: "info" as const },
  delete: { label: "削除", tone: "error" as const },
};

export function DiffPreview({ diff, dataset, limit = 300, total }: { diff: DiffItem[]; dataset?: string; limit?: number; total?: number }) {
  const [filter, setFilter] = useState<"all" | DiffItem["op"]>("all");
  const ds = dataset ? getDataset(dataset) : undefined;
  const label = (col: string) => ds?.columns.find((c) => c.name === col)?.label ?? col;
  const shown = diff.filter((d) => filter === "all" || d.op === filter);
  const n = (op: DiffItem["op"]) => diff.filter((d) => d.op === op).length;

  if (!diff.length) return <EmptyState title="差分はありません" compact />;
  return (
    <div>
      <div className="flex gap-1 border-b border-line px-4 py-2" role="tablist" aria-label="差分の絞り込み">
        {(["all", "add", "change", "delete"] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-2.5 py-1 text-xs ${filter === f ? "bg-charcoal-soft font-medium text-charcoal" : "text-muted hover:bg-line-soft"}`}
          >
            {f === "all" ? `すべて ${diff.length}` : `${OP[f].label} ${n(f)}`}
          </button>
        ))}
      </div>
      {(total ?? diff.length) > Math.min(limit, diff.length) && (
        <p className="border-b border-line px-4 py-2 text-xs text-muted">
          差分が多いため、先頭 {Math.min(limit, diff.length).toLocaleString()} 件のみ表示しています（全 {(total ?? diff.length).toLocaleString()} 件。件数は上の集計を参照）。
        </p>
      )}
      <div className="max-h-[440px] overflow-auto">
        <table className="dt">
          <thead>
            <tr>
              <th className="w-16">操作</th>
              <th className="w-28">キー</th>
              <th>内容</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((d) => (
              <tr key={d.op + d.key}>
                <td>
                  <Badge tone={OP[d.op].tone}>{OP[d.op].label}</Badge>
                </td>
                <td className="font-mono text-xs">{d.key}</td>
                <td className="text-xs">
                  {d.op === "change" ? (
                    <ul className="space-y-0.5">
                      {d.changes.map((c) => (
                        <li key={c.column} className="flex flex-wrap items-baseline gap-1.5">
                          <span className="min-w-20 text-muted">{label(c.column)}</span>
                          <del className="rounded bg-bad-soft px-1 text-bad decoration-bad/50">{c.before ?? "（空）"}</del>
                          <span className="text-subtle" aria-hidden>
                            →
                          </span>
                          <ins className="rounded bg-ok-soft px-1 font-medium text-ok no-underline">{c.after ?? "（空）"}</ins>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className={d.op === "delete" ? "text-bad" : "text-ink/85"}>
                      {Object.entries(d.row)
                        .filter(([, v]) => v !== null && v !== "")
                        .map(([k, v]) => `${label(k)}: ${v}`)
                        .join(" ／ ")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length > limit && <p className="px-4 py-2 text-xs text-muted">ほか {shown.length - limit} 件は CSV 出力で確認できます</p>}
      </div>
    </div>
  );
}
