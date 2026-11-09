import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, XCircle } from "lucide-react";
import type { State } from "@/lib/judge";

const TONES = {
  success: "bg-ok-soft text-ok ring-ok-line",
  warning: "bg-warn-soft text-warn-ink ring-warn-line",
  error: "bg-bad-soft text-bad ring-bad-line",
  info: "bg-info-soft text-info ring-info-line",
  charcoal: "bg-charcoal-soft text-charcoal ring-[#d9dadb]",
  neutral: "bg-line-soft text-muted ring-line",
};
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap ring-1 ring-inset ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** データ・対応・版の承認状態 */
const STATUS: Record<string, { tone: Tone; label?: string; icon?: typeof CheckCircle2 }> = {
  適合確認済み: { tone: "success", icon: CheckCircle2 },
  自社対応確認済み: { tone: "success", icon: CheckCircle2 },
  解析済み: { tone: "info" },
  収集済み: { tone: "neutral", icon: CircleDashed },
  未確認: { tone: "warning", icon: Clock3 },
  published: { tone: "success", label: "公開中", icon: CheckCircle2 },
  pending: { tone: "warning", label: "承認待ち", icon: Clock3 },
  superseded: { tone: "neutral", label: "旧版" },
  rejected: { tone: "error", label: "差戻し", icon: XCircle },
};

export function ApprovalStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { tone: "neutral" as Tone };
  const Icon = s.icon;
  return (
    <Badge tone={s.tone}>
      {Icon && <Icon size={12} aria-hidden />}
      {s.label ?? status}
    </Badge>
  );
}

export const VERSION_STATUS_LABEL: Record<string, string> = { pending: "承認待ち", published: "公開中", superseded: "旧版", rejected: "差戻し" };

export const RESULT_STATE: Record<State, { label: string; tone: Tone; icon: typeof CheckCircle2 }> = {
  confirmed: { label: "確認済み", tone: "success", icon: CheckCircle2 },
  needs_check: { label: "条件不足・要確認", tone: "warning", icon: AlertTriangle },
  not_found: { label: "未登録", tone: "error", icon: XCircle },
};

export function ResultStateBadge({ state }: { state: State }) {
  const m = RESULT_STATE[state];
  const Icon = m.icon;
  return (
    <Badge tone={m.tone}>
      <Icon size={12} aria-hidden />
      {m.label}
    </Badge>
  );
}

export function CustomerUseBadge({ allowed }: { allowed: boolean }) {
  return allowed ? <Badge tone="success">顧客回答可</Badge> : <Badge tone="error">顧客回答不可</Badge>;
}
