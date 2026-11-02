import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

const VARIANT = {
  info: { cls: "border-[#bfdbfe] bg-action-soft", icon: Info, color: "text-action" },
  success: { cls: "border-ok-line bg-ok-soft", icon: CheckCircle2, color: "text-ok" },
  warning: { cls: "border-warn-line bg-warn-soft", icon: AlertTriangle, color: "text-warn" },
  error: { cls: "border-bad-line bg-bad-soft", icon: XCircle, color: "text-bad" },
};

export function AlertMessage({
  variant = "info",
  title,
  children,
  action,
  className = "",
}: {
  variant?: keyof typeof VARIANT;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const v = VARIANT[variant];
  const Icon = v.icon;
  return (
    <div role={variant === "error" ? "alert" : "status"} className={`flex gap-3 rounded-card border px-4 py-3 text-sm ${v.cls} ${className}`}>
      <Icon size={18} className={`mt-0.5 shrink-0 ${v.color}`} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <div className="font-medium text-ink">{title}</div>}
        {children && <div className={`text-ink/85 ${title ? "mt-0.5" : ""}`}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
