import { BACKUP_FREQUENCIES, DEFAULT_BACKUP, getSetting, setSetting } from "@/lib/repo";
import { actorOf, fail, ok } from "@/lib/api";

export async function GET() {
  return ok({
    auto_reply_enabled: await getSetting("auto_reply_enabled", true),
    backup: await getSetting("backup", DEFAULT_BACKUP),
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (actorOf(body).role !== "approver") return fail("設定の変更は承認者のみ操作できます", 403);
  if ("auto_reply_enabled" in body) await setSetting("auto_reply_enabled", !!body.auto_reply_enabled);
  if (body.backup) {
    const b = body.backup;
    const days = Number(b.retention_days);
    if (!Number.isInteger(days) || days < 7 || days > 365) return fail("保持期間は 7〜365 日で指定してください");
    if (!BACKUP_FREQUENCIES.includes(b.frequency)) return fail("実行頻度が不正です");
    await setSetting("backup", { frequency: b.frequency, retention_days: days });
  }
  return ok({
    auto_reply_enabled: await getSetting("auto_reply_enabled", true),
    backup: await getSetting("backup", DEFAULT_BACKUP),
  });
}
