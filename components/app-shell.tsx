"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children, dbMode }: { children: React.ReactNode; dbMode: "neon" | "demo" }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);

  return (
    <div className="min-h-screen lg:pl-60">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        本文へスキップ
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-line bg-surface lg:block">
        <AppSidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="メニュー">
          <div className="absolute inset-0 bg-[#282a2c]/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-pop">
            <AppSidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <AppHeader onMenu={() => setOpen(true)} dbMode={dbMode} />
      <main id="main" className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
