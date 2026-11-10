import { NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessToken, safeEqual, safeNext } from "@/lib/access";

// 入口のパスワード確認（閲覧制限）。フォーム送信（POST）を受け、cookie を発行して元の画面に戻す
export async function POST(req: Request) {
  const password = process.env.ACCESS_PASSWORD;
  const form = await req.formData();
  const next = safeNext(String(form.get("next") ?? ""));
  if (!password) return NextResponse.redirect(new URL(next, req.url), 303);

  const input = String(form.get("password") ?? "");
  const [want, got] = await Promise.all([accessToken(password), accessToken(input)]);
  if (!input || !safeEqual(want, got)) {
    // 総当たり対策として失敗時は少し待つ
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, req.url), 303);
  }
  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(ACCESS_COOKIE, want, { httpOnly: true, secure: new URL(req.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: ACCESS_MAX_AGE });
  return res;
}
