import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { ActorProvider } from "@/components/actor";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";

// ブランドガイドライン p.09: 和文は Noto Sans JP（本文 Regular/Medium、見出し Bold/Black）。英字は Arial（globals.css）
const noto = Noto_Sans_JP({ subsets: ["latin"], weight: ["400", "500", "700", "900"], variable: "--font-noto", display: "swap" });

export const metadata: Metadata = {
  title: { default: "バッテリー適合検索システム | DBJ", template: "%s | DBJ バッテリー適合検索" },
  description: "ディスカバーバッテリージャパン株式会社 社内用 自動車バッテリー適合検索システム",
};

export const viewport: Viewport = { themeColor: "#4B9F45" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={noto.variable}>
      <body className="font-sans antialiased">
        <ActorProvider>
          <AppShell dbMode={db().mode}>{children}</AppShell>
        </ActorProvider>
      </body>
    </html>
  );
}
