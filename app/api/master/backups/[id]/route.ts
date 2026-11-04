import { getBackup } from "@/lib/repo";
import { fail } from "@/lib/api";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const b = await getBackup(Number((await ctx.params).id));
  if (!b) return fail("バックアップが見つかりません", 404);
  const stamp = new Date(b.at).toISOString().slice(0, 10);
  return new Response(JSON.stringify({ id: b.id, created_at: b.at, trigger: b.trigger_type, ...b.data }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dbj_backup_${stamp}_${b.id}.json"`,
    },
  });
}
