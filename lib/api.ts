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

/** 解凍後の上限（DBJ 適合データ 約 25MB に余裕を持たせる） */
const MAX_BODY = 60 * 1024 * 1024;

/** JSON 本文を読む。X-Body-Encoding: gzip の場合は解凍する（postJson が大きな本文を圧縮して送る） */
export async function readJson(req: Request): Promise<any> {
  if (req.headers.get("x-body-encoding") !== "gzip") return req.json();
  if (!req.body) throw new Error("本文がありません");
  const reader = req.body.pipeThrough(new DecompressionStream("gzip")).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY) {
      await reader.cancel();
      throw new Error("ファイルが大きすぎます（解凍後 60MB まで）");
    }
    chunks.push(value);
  }
  return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
}
