// 車両検索の入口（Web・LINE・OCR で共通）。
// DBJ 適合データ（判定付き）に該当する行があればそれで回答し、なければ従来の車両マスターで判定する。
import { judgeVehicle, type JudgeResult, type VehicleQuery } from "./judge";
import { fitmentHints, judgeFitment } from "./fitment";
import { loadFitmentsFor, loadMasterFor } from "./repo";

export async function searchVehicle(q: VehicleQuery): Promise<JudgeResult> {
  const [fit, master] = await Promise.all([loadFitmentsFor(q.modelCode), loadMasterFor(q.modelCode)]);
  const r = judgeFitment(q, fit);
  if (r) return r;
  const old = judgeVehicle(q, master);
  if (old.state === "not_found") old.hints = [...old.hints, ...fitmentHints(q, fit)];
  return old;
}
