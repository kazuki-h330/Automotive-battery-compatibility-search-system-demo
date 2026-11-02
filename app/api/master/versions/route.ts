import { listVersions } from "@/lib/repo";
import { ok } from "@/lib/api";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dataset = url.searchParams.get("dataset") || undefined;
  const status = url.searchParams.get("status");
  const rows = await listVersions(dataset);
  return ok(status ? rows.filter((r) => r.status === status) : rows);
}
