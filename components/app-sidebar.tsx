"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BatteryCharging, Lock } from "lucide-react";
import { FUTURE_NAV, MAIN_NAV } from "./nav";

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-white">
          <BatteryCharging size={18} aria-hidden />
        </span>
        <span className="leading-tight">
          <span className="block text-[13px] font-bold text-navy">DBJ 適合検索</span>
          <span className="block text-[11px] text-muted">Discover Battery Japan</span>
        </span>
      </Link>

      <nav aria-label="メインメニュー" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {MAIN_NAV.map((it) => {
            const active = isActive(it.href);
            const Icon = it.icon;
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] transition-colors ${
                    active ? "bg-navy-soft font-medium text-navy" : "text-ink/80 hover:bg-line-soft hover:text-ink"
                  }`}
                >
                  {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-navy" aria-hidden />}
                  <Icon size={17} strokeWidth={1.8} aria-hidden />
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 border-t border-line pt-4">
          <div className="mb-1.5 flex items-center justify-between px-3">
            <span className="text-[11px] font-medium tracking-wide text-muted">将来拡張</span>
            <span className="rounded bg-line-soft px-1.5 text-[10px] text-muted">Phase 1 未実装</span>
          </div>
          <ul className="space-y-0.5">
            {FUTURE_NAV.map((it) => {
              const active = isActive(it.href);
              const Icon = it.icon;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] ${
                      active ? "bg-line-soft text-ink" : "text-subtle hover:bg-line-soft hover:text-muted"
                    }`}
                  >
                    <Icon size={17} strokeWidth={1.8} aria-hidden />
                    <span className="flex-1">{it.label}</span>
                    <Lock size={12} aria-label="未実装" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="border-t border-line px-5 py-3 text-[11px] text-subtle">Phase 1 ・ 架空の検証データ</div>
    </div>
  );
}
