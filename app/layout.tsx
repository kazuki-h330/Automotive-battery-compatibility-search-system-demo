import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { ActorProvider } from "@/components/actor";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const noto = Noto_Sans_JP({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-noto", display: "swap" });

export const metadata: Metadata = {
  title: { default: "バッテリー適合検索システム | DBJ", template: "%s | DBJ バッテリー適合検索" },
  description: "株式会社ディスカバーバッテリージャパン 社内用 自動車バッテリー適合検索システム",
};

export const viewport: Viewport = { themeColor: "#163B65" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${inter.variable} ${noto.variable}`}>
      <body className="font-sans antialiased">
        <ActorProvider>
          <AppShell dbMode={db().mode}>{children}</AppShell>
        </ActorProvider>
      </body>
    </html>
  );
}
