import { getDataset, type DatasetId } from "@/lib/datasets";
import { validate } from "@/lib/repo";
import { fail, ok } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const { dataset, mode, csv } = await req.json();
    if (!getDataset(dataset)) return fail("データセットが不正です");
    if (!["upsert", "replace", "delete"].includes(mode)) return fail("取込方式が不正です");
    const v = await validate(dataset as DatasetId, mode, String(csv ?? ""));
    return ok({ ...v, snapshot: undefined });
  } catch (e) {
    return fail(e, 500);
  }
}
