import { judgeProduct, type ProductQuery } from "@/lib/judge";
import { loadMaster, logAnswer } from "@/lib/repo";
import { actorOf, fail, ok } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const q: ProductQuery = body.query ?? {};
    if (!q.partNo?.trim() && !q.spec?.trim()) return fail("現物品番または規格表記を入力してください");
    const result = judgeProduct(q, await loadMaster());
    const versions = await logAnswer("web", result, actorOf(body).name);
    return ok({ result, versions });
  } catch (e) {
    return fail(e, 500);
  }
}
