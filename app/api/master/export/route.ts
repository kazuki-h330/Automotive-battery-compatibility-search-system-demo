import { getDataset, type DatasetId } from "@/lib/datasets";
import { toCsv } from "@/lib/csv";
import { getVersion, loadDataset } from "@/lib/repo";
import { fail } from "@/lib/api";

// 公開中データまたは指定版のスナップショットを定型 CSV で出力（バックアップ・再取込用）
export async function GET(req: Request) {
  const url = new URL(req.url);
  const versionId = url.searchParams.get("version");
  let dataset = url.searchParams.get("dataset") ?? "";
  let rows;
  let suffix = "current";
  if (versionId) {
    const v = await getVersion(Number(versionId));
    if (!v) return fail("版が見つかりません", 404);
    dataset = v.dataset;
    rows = v.snapshot;
    suffix = `v${v.version_no}`;
  } else {
    if (!getDataset(dataset)) return fail("データセットが不正です");
    rows = await loadDataset(dataset as DatasetId);
  }
  return new Response(toCsv(dataset as DatasetId, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dataset}_${suffix}.csv"`,
    },
  });
}
