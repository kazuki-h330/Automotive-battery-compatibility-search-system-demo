import { approve, getVersion, previewRestore, reject, requestRestore } from "@/lib/repo";
import { actorOf, fail, ok } from "@/lib/api";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  try {
    if (new URL(req.url).searchParams.get("preview") === "restore") return ok(await previewRestore(id));
  } catch (e) {
    return fail(e, 404);
  }
  const v = await getVersion(id);
  if (!v) return fail("版が見つかりません", 404);
  return ok({ ...v, snapshot: undefined, snapshot_count: v.snapshot.length });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await ctx.params).id);
    const body = await req.json();
    const actor = actorOf(body);
    if (body.action === "approve") await approve(id, actor, body.note);
    else if (body.action === "reject") await reject(id, actor, body.note);
    else if (body.action === "restore") {
      const r = await requestRestore(id, actor);
      if (!r.ok) return ok({ ok: false, errors: r.validation.errors }, { status: 422 });
      return ok({ ok: true, version: r.version });
    } else return fail("操作が不正です");
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
