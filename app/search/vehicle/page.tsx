import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { loadDataset } from "@/lib/repo";
import { splitList } from "@/lib/normalize";
import { VehicleSearch } from "./vehicle-search";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "車両から検索" };

export default async function Page({ searchParams }: { searchParams: Promise<{ model?: string; reg?: string }> }) {
  const { model, reg } = await searchParams;
  const vehicles = await loadDataset("vehicles");
  const makers = [...new Set(vehicles.map((v) => v.maker as string))];
  const conditions = [...new Set(vehicles.flatMap((v) => splitList(v.conditions)))];
  return (
    <>
      <PageHeader
        title="車両から検索"
        description="車検証の型式（必須）と初度登録年月・原動機型式・装備条件から、承認済みの自社品番を確認します。候補が複数ある場合や未承認の対応を含む場合は確定せず、追加で確認すべき項目を表示します。"
      />
      <VehicleSearch makers={makers} conditions={conditions} initialModel={model} initialReg={reg} />
    </>
  );
}
