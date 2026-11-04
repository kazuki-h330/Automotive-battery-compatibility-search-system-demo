import { NextResponse } from "next/server";
import type { Actor } from "./repo";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(e: unknown, status = 400) {
  // サーバー内部のエラー詳細は画面に出さず、ログにのみ残す
  if (status >= 500) console.error(e);
  const message = status >= 500 ? "サーバーでエラーが発生しました" : e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: message }, { status });
}

// 認証は次段階で導入。デモでは画面右上で選んだ利用者を受け取る
export function actorOf(body: { actor?: Partial<Actor> } | null | undefined): Actor {
  const a = body?.actor;
  const role = a?.role === "approver" || a?.role === "viewer" ? a.role : "staff";
  return { name: String(a?.name ?? "デモ利用者").slice(0, 40), role };
}
