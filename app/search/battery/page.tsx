import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { loadDataset } from "@/lib/repo";
import { BatterySearch } from "./battery-search";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "バッテリー品番検索" };

export default async function Page() {
  const products = await loadDataset("products");
  const makers = [...new Set(products.map((p) => p.maker as string))];
  return (
    <>
      <PageHeader
        title="バッテリー品番検索"
        description="お手元のバッテリーの品番（旧品番・別名を含む）または規格表記から、自社の置換品番を確認します。商品コードと規格表記は別項目として扱い、原表記を保持します。"
      />
      <BatterySearch makers={makers} />
    </>
  );
}
