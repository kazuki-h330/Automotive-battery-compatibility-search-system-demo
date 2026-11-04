import { createBackup, listBackups } from "@/lib/repo";
import { actorOf, fail, ok } from "@/lib/api";

export async function GET() {
  return ok(await listBackups());
}

// 手動バックアップ（承認者のみ）
export async function POST(req: Request) {
  try {
    const actor = actorOf(await req.json());
    if (actor.role !== "approver") return fail("バックアップの作成は承認者のみ操作できます", 403);
    await createBackup("manual", actor.name);
    return ok({ backups: await listBackups() });
  } catch (e) {
    return fail(e, 500);
  }
}
