import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { VersionHistory } from "@/components/version-history";

export const metadata: Metadata = { title: "承認・更新履歴" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ dataset?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="承認・更新履歴"
        description="マスターの申請・承認・反映・復元の履歴です。各版の差分を確認でき、承認者は旧版への復元を申請できます（影響を確認したうえで、別の承認者の承認後に反映）。"
      />
      <VersionHistory initialDataset={sp.dataset ?? ""} />
    </>
  );
}
