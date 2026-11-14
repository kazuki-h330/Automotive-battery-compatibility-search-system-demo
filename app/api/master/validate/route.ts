import { getDataset, type DatasetId } from "@/lib/datasets";
import { trimForResponse, validate } from "@/lib/repo";
import { fail, ok, readJson } from "@/lib/api";

// 1 万行規模の取込・承認に備えて実行時間の上限を延ばす（Vercel）
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { dataset, mode, csv } = await readJson(req);
    if (!getDataset(dataset)) return fail("データセットが不正です");
    if (!["upsert", "replace", "delete"].includes(mode)) return fail("取込方式が不正です");
    const v = await validate(dataset as DatasetId, mode, String(csv ?? ""));
    return ok(trimForResponse(v));
  } catch (e) {
    return fail(e, 500);
  }
}
