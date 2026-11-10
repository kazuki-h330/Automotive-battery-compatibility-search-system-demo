import type { Metadata } from "next";
import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import { safeNext } from "@/lib/access";

export const metadata: Metadata = { title: "パスワードの入力", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form method="post" action="/api/login" className="card w-full max-w-sm px-6 py-7">
        <Image src="/brand/dbj-logo.png" alt="DBJ ディスカバーバッテリージャパン" width={180} height={56} className="mx-auto mb-5 h-auto w-44" priority />
        <h1 className="flex items-center justify-center gap-1.5 text-base font-bold">
          <LockKeyhole size={16} aria-hidden /> 閲覧にはパスワードが必要です
        </h1>
        <p className="mt-2 text-center text-xs text-muted">社内向けデータを含むため、閲覧を制限しています。</p>
        <input type="hidden" name="next" value={safeNext(next)} />
        <label htmlFor="password" className="field-label mt-5">
          パスワード
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus className="field" aria-invalid={!!error} aria-describedby={error ? "pw-error" : undefined} />
        {error && (
          <p id="pw-error" role="alert" className="mt-1.5 text-xs text-bad">
            パスワードが違います
          </p>
        )}
        <button type="submit" className="btn-primary mt-4 w-full">
          表示する
        </button>
      </form>
    </div>
  );
}
