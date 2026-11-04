import { DEFAULT_BACKUP, createBackup, getSetting } from "@/lib/repo";
import { fail, ok } from "@/lib/api";

// Vercel Cron から毎日 18:00 UTC（日本時間 3:00）に呼ばれる。CRON_SECRET で呼び出し元を確認する
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return fail("認証エラー", 401);
  try {
    const { frequency } = await getSetting("backup", DEFAULT_BACKUP);
    const jstDay = new Date(Date.now() + 9 * 3600 * 1000).getUTCDay();
    if (frequency.startsWith("毎週") && jstDay !== 1) return ok({ skipped: true, frequency });
    const backup = await createBackup("scheduled", null);
    return ok({ ok: true, id: backup.id, row_count: backup.row_count });
  } catch (e) {
    return fail(e, 500);
  }
}
