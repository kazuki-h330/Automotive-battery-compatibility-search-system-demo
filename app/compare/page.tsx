import type { Metadata } from "next";
import { ComparisonTable, type CompareRow } from "@/components/comparison-table";
import { PageHeader } from "@/components/page-header";
import { CATEGORIES } from "@/lib/datasets";
import { typeOf } from "@/lib/judge";
import { loadMaster } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "メーカー品番比較" };

export default async function Page() {
  const d = await loadMaster();
  const src = (id: string) => d.sources.find((s) => s.id === id);
  const truthy = (v: unknown) => v === true || v === "true";

  const keys = new Map<string, { category: string; spec_code: string }>();
  for (const x of [...d.ownProducts, ...d.products, ...d.batteries]) keys.set(`${x.category}|${x.spec_code}`, { category: x.category, spec_code: x.spec_code });

  const makers = [...new Set(d.products.map((p) => p.maker as string))];
  const rows: CompareRow[] = [...keys.values()].map(({ category, spec_code }) => {
    const prods = d.products.filter((p) => p.category === category && p.spec_code === spec_code);
    const own = d.ownProducts.find((o) => o.category === category && o.spec_code === spec_code);
    const ref = own ?? prods[0];
    const maps = d.mappings.filter((m) => m.match_type === "spec" && m.category === category && m.spec_code === spec_code);
    const fitted = d.batteries.filter((b) => b.category === category && b.spec_code === spec_code);
    return {
      key: `${category}|${spec_code}`,
      category,
      spec_code,
      size_group: ref?.size_group ?? "—",
      battery_type: typeOf(category),
      spec: ref
        ? {
            capacity: `${ref.capacity_ah ?? "—"}Ah`,
            cca: `CCA ${ref.cca ?? "—"}`,
            dims: `${ref.length_mm ?? "—"}×${ref.width_mm ?? "—"}×${ref.height_mm ?? "—"}`,
            terminal: ref.terminal ?? "—",
            application: ref.application ?? "",
          }
        : null,
      fitment: fitted.map((b) => {
        const v = d.vehicles.find((x) => x.id === b.vehicle_id);
        return `${v?.car_name ?? "?"}（${v?.model_code ?? "?"}）${b.role}${b.qty > 1 ? `×${b.qty}` : ""}`;
      }),
      makers: Object.fromEntries(
        makers.map((m) => [
          m,
          prods
            .filter((p) => p.maker === m)
            .map((p) => ({
              part_no: p.part_no,
              aliases: p.aliases ?? "",
              status: p.status,
              source: src(p.source_id)?.name ?? "",
              replace: d.mappings.find((x) => x.match_type === "product" && x.product_id === p.id)?.status ?? null,
            })),
        ]),
      ),
      own: maps.map((m) => ({
        part_no: m.own_part_no,
        status: m.status,
        customer_use: truthy(m.customer_use) && truthy(src(m.source_id)?.customer_use),
        direction: m.direction,
        conditions: m.conditions ?? "",
      })),
      notes: [...new Set([...prods.map((p) => p.note), own?.note, ...maps.map((m) => m.note)].filter(Boolean) as string[])],
      sources: [...new Set([...maps.map((m) => src(m.source_id)?.name), ...prods.map((p) => src(p.source_id)?.name)].filter(Boolean) as string[])],
    };
  });
  rows.sort((a, b) => a.spec_code.localeCompare(b.spec_code, "ja", { numeric: true }));

  return (
    <>
      <PageHeader
        title="メーカー品番比較"
        description="規格区分ごとに、規格・サイズ・必要仕様・新車搭載情報・各社品番・DBJ 自社品番・確認状態・出典を比較します。"
      />
      <ComparisonTable rows={rows} makers={makers} categories={[...CATEGORIES]} />
    </>
  );
}
