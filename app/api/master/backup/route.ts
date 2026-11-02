import { db } from "@/lib/db";
import { loadAllLive } from "@/lib/repo";

// 全マスターと版履歴の一括バックアップ（JSON）。本番では日次で自動取得し、Neon の PITR と併用する想定
export async function GET() {
  const data = await loadAllLive();
  const versions = await db().query(`SELECT * FROM master_versions ORDER BY id`);
  const settings = await db().query(`SELECT * FROM app_settings`);
  const body = JSON.stringify({ exported_at: new Date().toISOString(), data, versions, settings }, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dbj_backup_${stamp}.json"`,
    },
  });
}
