import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken, safeEqual } from "@/lib/access";

// 閲覧制限：ACCESS_PASSWORD が設定された環境（DBJ 様サンプル検証環境）のみ、全ページ・API に入口のパスワードを求める
export async function proxy(req: NextRequest) {
  const password = process.env.ACCESS_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  // ログイン画面・Vercel Cron（CRON_SECRET で別途確認）・LINE Webhook（署名で別途確認）は対象外
  if (pathname === "/login" || pathname === "/api/login" || pathname.startsWith("/api/cron/") || pathname === "/api/line/event") return noindex(NextResponse.next());

  const cookie = req.cookies.get(ACCESS_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await accessToken(password))) return noindex(NextResponse.next());

  if (pathname.startsWith("/api/")) return noindex(NextResponse.json({ error: "閲覧にはパスワードが必要です" }, { status: 401 }));
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return noindex(NextResponse.redirect(url));
}

/** 検索エンジンに登録させない */
function noindex(res: NextResponse) {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  // 静的ファイル・画像最適化・アイコン・ロゴは対象外
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/).*)"],
};
