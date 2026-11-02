import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { ok } from "@/lib/api";

// スタッフ対応の終了（自動応答を再開）
export async function POST(req: Request) {
  const body = await req.json();
  const userKey = createHash("sha256").update(String(body.userId ?? "demo")).digest("hex").slice(0, 16);
  await db().query(`DELETE FROM line_sessions WHERE user_key = $1`, [userKey]);
  return ok({ ok: true });
}
