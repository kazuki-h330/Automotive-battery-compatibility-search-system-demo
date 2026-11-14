import type { VehicleQuery } from "@/lib/judge";
import { logAnswer } from "@/lib/repo";
import { searchVehicle } from "@/lib/search";
import { actorOf, fail, ok } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const q: VehicleQuery = body.query;
    if (typeof q?.modelCode !== "string" || !q.modelCode.trim()) return fail("型式は必須です");
    const result = await searchVehicle(q);
    const versions = await logAnswer(body.channel === "ocr-demo" ? "ocr-demo" : "web", result, actorOf(body).name);
    return ok({ result, versions });
  } catch (e) {
    return fail(e, 500);
  }
}
