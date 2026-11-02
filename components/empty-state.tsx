import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "px-4 py-8" : "px-6 py-16"}`}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-line-soft text-subtle">
        <Icon size={22} aria-hidden />
      </div>
      <div className="text-sm font-medium text-ink">{title}</div>
      {description && <div className="mt-1 max-w-md text-[13px] text-muted">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
