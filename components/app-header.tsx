"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Menu, Settings, UserRound } from "lucide-react";
import { DEMO_ACTORS, ROLE_LABEL, useActor } from "./actor";
import { titleFor } from "./nav";
import { DBJ_SAMPLE } from "@/lib/profile";

export function AppHeader({ onMenu, dbMode }: { onMenu: () => void; dbMode: "neon" | "demo" }) {
  const path = usePathname();
  const { actor, setActor } = useActor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur md:px-6">
      <button className="btn-ghost btn-sm -ml-1 lg:hidden" onClick={onMenu} aria-label="メニューを開く">
        <Menu size={20} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold text-ink">{titleFor(path)}</div>
      </div>

      <span
        className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-muted md:flex"
        title={dbMode === "neon" ? "Neon（PostgreSQL）に接続中" : "インメモリのデモ DB で動作中（再起動で初期化）"}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dbMode === "neon" ? "bg-ok" : "bg-warn"}`} aria-hidden />
        {DBJ_SAMPLE ? "DBJ様サンプル検証環境" : dbMode === "neon" ? "本番 DB 接続" : "デモ環境"}
      </span>

      <div className="relative" ref={ref}>
        <button
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-line-soft"
          onClick={() => setOpen(!open)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-[12px] font-medium text-white" aria-hidden>
            {actor.name.slice(0, 1)}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-[13px] font-medium">{actor.name}</span>
            <span className="block text-[11px] text-muted">
              {actor.dept}・{ROLE_LABEL[actor.role]}
            </span>
          </span>
          <ChevronDown size={14} className="text-muted" aria-hidden />
        </button>

        {open && (
          <div role="menu" className="absolute right-0 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
            <div className="border-b border-line px-4 py-3">
              <div className="text-sm font-medium">{actor.name}</div>
              <div className="text-xs text-muted">{actor.email}</div>
              <div className="mt-1 text-xs text-muted">
                権限: <span className="font-medium text-navy">{ROLE_LABEL[actor.role]}</span>
              </div>
            </div>
            <div className="px-2 py-2">
              <div className="px-2 pb-1 text-[11px] text-muted">利用者の切替（デモ用・ログインは次段階で実装）</div>
              {DEMO_ACTORS.map((a) => (
                <button
                  key={a.name}
                  role="menuitemradio"
                  aria-checked={a.name === actor.name}
                  onClick={() => {
                    setActor(a);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-line-soft"
                >
                  <UserRound size={14} className="text-muted" aria-hidden />
                  <span className="flex-1">{a.name}</span>
                  <span className="text-[11px] text-muted">{ROLE_LABEL[a.role]}</span>
                  {a.name === actor.name ? <Check size={14} className="text-action" aria-hidden /> : <span className="w-3.5" />}
                </button>
              ))}
            </div>
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-[13px] hover:bg-line-soft"
            >
              <Settings size={14} className="text-muted" aria-hidden /> アカウント・システム設定
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
