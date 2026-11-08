import { getDataset, type DatasetId } from "@/lib/datasets";
import { submitImport, trimForResponse } from "@/lib/repo";
import { actorOf, fail, ok } from "@/lib/api";

// 1 万行規模の取込・承認に備えて実行時間の上限を延ばす（Vercel）
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!getDataset(body.dataset)) return fail("データセットが不正です");
    if (!["upsert", "replace", "delete"].includes(body.mode)) return fail("取込方式が不正です");
    const r = await submitImport(
      body.dataset as DatasetId,
      body.mode,
      String(body.csv ?? ""),
      String(body.fileName ?? ""),
      actorOf(body),
      body.allowDelete === true,
    );
    if (!r.ok) return ok({ ok: false, validation: trimForResponse(r.validation) }, { status: 422 });
    return ok({ ok: true, version: r.version });
  } catch (e) {
    return fail(e);
  }
}
