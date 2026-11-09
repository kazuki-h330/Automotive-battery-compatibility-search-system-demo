"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { FUTURE_NAV, MAIN_NAV } from "./nav";

/*
 * ロゴ表示はブランドガイドライン（2026年7月版）に従う
 *  - 社内システムの運営主体として DBJ 正式ロゴ（フルカラー支給データ）を主表示（p.04, p.07）
 *    デジタル最小幅 180px 以上、保護余白は DBJ 部分の高さ X に対し 0.25X 以上（p.06）
 *  - フッターの運営者表示は「Discover＋説明文」（p.07）。DBJ と同じ大きさで並べない
 *  - 支給データの比率・色は変更しない（余白のトリミングのみ。public/brand/）
 */
const DBJ_LOGO = { src: "/brand/dbj-logo.png", w: 184, h: 71 };
const DISCOVER_LOGO = { src: "/brand/discover-logo.png", w: 144, h: 42 };

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="block shrink-0 border-b border-line px-7 pt-6 pb-4" aria-label="ホーム（DBJ バッテリー適合検索システム）">
        <Image
          src={DBJ_LOGO.src}
          width={DBJ_LOGO.w}
          height={DBJ_LOGO.h}
          alt="DBJ DISCOVER BATTERY JAPAN"
          unoptimized
          loading="eager"
          className="h-auto w-[184px] max-w-none"
        />
        <span className="mt-4 flex items-center gap-2 text-[13px] font-bold tracking-wide text-charcoal">
          <span className="h-3.5 w-[3px] rounded-full bg-brand-accent" aria-hidden />
          バッテリー適合検索
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
                    active ? "bg-charcoal-soft font-medium text-charcoal" : "text-ink/80 hover:bg-line-soft hover:text-ink"
                  }`}
                >
                  {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-brand-accent" aria-hidden />}
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

      <footer className="shrink-0 border-t border-line px-6 pt-4 pb-3">
        <Image
          src={DISCOVER_LOGO.src}
          width={DISCOVER_LOGO.w}
          height={DISCOVER_LOGO.h}
          alt="Discover Innovative Battery Solutions"
          unoptimized
          className="h-auto w-[144px] max-w-none"
        />
        <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
          日本国内における販売・サポート
          <br />
          ディスカバーバッテリージャパン株式会社
        </p>
        <p className="mt-2 text-[10.5px] text-subtle">Phase 1 ・ 架空の検証データ</p>
      </footer>
    </div>
  );
}
