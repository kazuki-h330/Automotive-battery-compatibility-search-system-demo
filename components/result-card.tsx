"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ClipboardCopy, Info, ListChecks } from "lucide-react";
import type { JudgeResult } from "@/lib/judge";
import { ApprovalStatusBadge, Badge, CustomerUseBadge, RESULT_STATE } from "./status-badge";

const FRAME = {
  confirmed: "border-ok-line",
  needs_check: "border-warn-line",
  not_found: "border-bad-line",
};
const HEAD = {
  confirmed: "bg-ok-soft",
  needs_check: "bg-warn-soft",
  not_found: "bg-bad-soft",
};
const ICON_COLOR = { confirmed: "text-ok", needs_check: "text-warn", not_found: "text-bad" };

export function CopyAnswer({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="flex items-center justify-between border-b border-line bg-canvas px-3 py-2">
        <span className="text-xs font-medium text-muted">顧客向け定型回答文</span>
        <button
          type="button"
          className={copied ? "btn-secondary btn-sm text-ok" : "btn-primary btn-sm"}
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? <Check size={14} aria-hidden /> : <ClipboardCopy size={14} aria-hidden />}
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>
      <p className="bg-surface px-4 py-3 text-sm leading-7 whitespace-pre-wrap">{text}</p>
      <span className="sr-only" aria-live="polite">
        {copied ? "回答文をコピーしました" : ""}
      </span>
    </div>
  );
}

/** 判定結果カード（状態の見出し・理由・不足項目・回答用品番） */
export function ResultCard({
  r,
  kindLabel,
  children,
}: {
  r: JudgeResult;
  kindLabel: string;
  children?: React.ReactNode;
}) {
  const meta = RESULT_STATE[r.state];
  const Icon = meta.icon;
  return (
    <section className={`card overflow-hidden ${FRAME[r.state]}`} aria-live="polite">
      <div className={`flex flex-wrap items-start gap-3 px-5 py-4 ${HEAD[r.state]}`}>
        <Icon size={22} className={`mt-0.5 shrink-0 ${ICON_COLOR[r.state]}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[13px] font-bold ${ICON_COLOR[r.state]}`}>{meta.label}</span>
            <Badge tone="charcoal">{kindLabel}</Badge>
          </div>
          <div className="mt-0.5 text-base font-bold text-ink">{r.headline}</div>
        </div>
      </div>

      {r.state !== "confirmed" && (r.missing.length > 0 || r.reasons.length > 0) && (
        <div className="grid gap-4 border-t border-line px-5 py-4 md:grid-cols-2">
          {r.missing.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold">
                <ListChecks size={15} className="text-warn" aria-hidden /> 追加確認が必要な項目
              </div>
              <ul className="space-y-1.5">
                {r.missing.map((m) => (
                  <li key={m} className="flex items-center gap-2 rounded-md border border-warn-line bg-warn-soft px-3 py-1.5 text-[13px] font-medium text-warn-ink">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.reasons.length > 0 && (
            <div className={r.missing.length ? "" : "md:col-span-2"}>
              <div className="mb-2 text-[13px] font-bold">{r.state === "not_found" ? "理由" : "確定できない理由"}</div>
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink/85">
                {r.reasons.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {r.hints.length > 0 && (
        <ul className="space-y-1 border-t border-line px-5 py-3">
          {r.hints.map((h, i) => (
            <li key={i} className="flex gap-2 text-[13px] text-ink/85">
              <Info size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden />
              {h}
            </li>
          ))}
        </ul>
      )}

      {r.state === "confirmed" && r.answer && (
        <div className="space-y-4 border-t border-line px-5 py-4">
          <div>
            <div className="mb-2 text-[13px] font-bold">承認済みの自社品番</div>
            <div className="flex flex-wrap gap-3">
              {r.answer.parts.map((p, i) => (
                <div key={i} className="min-w-44 rounded-lg border border-ok-line bg-surface px-4 py-3">
                  <div className="text-[11px] text-muted">
                    {p.role}
                    {p.qty > 1 ? `・${p.qty}個 同時搭載` : ""}
                  </div>
                  <div className="text-lg font-bold tracking-wide text-charcoal tnum">{p.part_no}</div>
                  {p.name && <div className="text-xs text-muted">{p.name}</div>}
                </div>
              ))}
            </div>
          </div>
          {r.answer.conditions && r.answer.conditions.length > 0 && (
            <div>
              <div className="mb-2 text-[13px] font-bold">必要条件</div>
              <ul className="grid gap-x-6 gap-y-1 text-[13px] text-ink/85 sm:grid-cols-2">
                {r.answer.conditions.map((c) => (
                  <li key={c} className="flex gap-2">
                    <Check size={14} className="mt-1 shrink-0 text-ok" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <CopyAnswer text={r.answer.template} />
        </div>
      )}

      {r.state !== "confirmed" && r.internalParts.length > 0 && (
        <div className="border-t border-line px-5 py-4">
          <div className="mb-1 text-[13px] font-bold">社内参考：登録されている自社対応</div>
          <p className="mb-2 text-xs text-muted">要確認のため、顧客への回答には使用しないでください。</p>
          <div className="flex flex-wrap gap-2">
            {r.internalParts.map((p, i) => (
              <div key={i} className="rounded-lg border border-line px-3 py-2">
                <div className="text-[11px] text-muted">{p.role}</div>
                <div className="text-sm font-bold tnum">{p.part_no}</div>
                <div className="mt-1 flex gap-1">
                  <ApprovalStatusBadge status={p.status} />
                  <CustomerUseBadge allowed={p.customer_use} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {r.cases && r.cases.length > 0 && <CaseRecords cases={r.cases} />}
      {children}
    </section>
  );
}

/** 参考：実車確認記録（記録の車両 1 台に限る。確定回答・自動返信には使わない） */
function CaseRecords({ cases }: { cases: NonNullable<JudgeResult["cases"]> }) {
  return (
    <div className="border-t border-line px-5 py-4">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[13px] font-bold">
        参考：実車確認記録 <Badge tone="warning">記録の車両 1 台に限る</Badge>
      </div>
      <p className="mb-3 text-xs text-muted">
        同じ型式の他の車両には適用しません。車検証の型式指定番号・類別区分番号・初度登録年月・原動機型式と、管理IDの記録を照合したうえでスタッフが判断してください。自動回答には使用しません。
      </p>
      <div className="space-y-3">
        {cases.map((c) => (
          <div key={c.id} className="rounded-lg border border-line px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-charcoal">{c.case_id}</span>
              <Badge tone={c.status === "実車確認済み" ? "success" : "neutral"}>{c.status}</Badge>
              <Badge tone={c.customer_use === true || c.customer_use === "true" ? "charcoal" : "neutral"}>
                {c.customer_use === true || c.customer_use === "true" ? "この車両への回答は承認済み" : "回答不可"}
              </Badge>
            </div>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
              <Item label="車両" value={`${c.maker} ${c.car_name ?? ""}／型式 ${c.model_code}`} />
              <Item label="確認した品番" value={c.own_part_no} strong />
              <Item label="原動機型式" value={c.engine_code} />
              <Item label="型式指定番号・類別区分番号" value={c.type_specification_no || c.classification_no ? `${c.type_specification_no ?? "—"}・${c.classification_no ?? "—"}` : null} />
              <Item label="搭載" value={c.role ? `${c.role}${c.qty ? `・${c.qty}個` : ""}${c.spec_code ? `（${c.category ?? ""} ${c.spec_code}）` : ""}` : null} />
              <Item label="承認" value={c.approved_by ? `${c.approved_by}（${c.approved_at ?? "日付なし"}）` : null} />
            </dl>
            {c.scope_note && <p className="mt-2 text-xs leading-6 text-ink/80"><span className="font-medium">仕様・範囲：</span>{c.scope_note}</p>}
            {c.source_note && (
              <details className="mt-1 text-xs leading-6 text-ink/80">
                <summary className="cursor-pointer text-brand">出典・根拠を表示</summary>
                {c.source_note}
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Item({ label, value, strong }: { label: string; value?: string | null; strong?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={strong ? "font-bold text-charcoal" : ""}>{value || "—"}</dd>
    </div>
  );
}

export function ModeNotice({ kind }: { kind: "vehicle" | "battery" }) {
  return kind === "vehicle" ? (
    <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
      この画面は<strong className="font-medium text-ink">車両への適合確認</strong>です。現物バッテリーからの置換は
      <Link href="/search/battery" className="inline-flex items-center text-brand hover:underline">
        バッテリー品番検索 <ArrowRight size={12} aria-hidden />
      </Link>
    </p>
  ) : (
    <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
      この画面は<strong className="font-medium text-ink">現物バッテリーの品番置換</strong>です。車両への適合確認は
      <Link href="/search/vehicle" className="inline-flex items-center text-brand hover:underline">
        車両から検索 <ArrowRight size={12} aria-hidden />
      </Link>
    </p>
  );
}

export function TraceDetails({ r, versions }: { r: JudgeResult; versions?: Record<string, number> }) {
  return (
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-[13px] font-medium">
        判定の経過・使用したマスター版
        <span className="text-xs font-normal text-muted group-open:hidden">表示</span>
      </summary>
      <div className="border-t border-line px-5 py-3 text-[13px]">
        <ol className="list-decimal space-y-1 pl-5 text-ink/80">
          {r.trace.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        {versions && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(versions).map(([k, v]) => (
              <Badge key={k}>
                {k} v{v}
              </Badge>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-muted">検索条件・判定結果・マスター版を操作ログに記録しました（個人情報は記録しません）。</p>
      </div>
    </details>
  );
}
