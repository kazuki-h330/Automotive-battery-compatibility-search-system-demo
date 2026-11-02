import type { Metadata } from "next";
import Link from "next/link";
import { Archive, Download, History, RotateCcw } from "lucide-react";
import { CSVUploadPanel } from "@/components/csv-upload-panel";
import { DataTable } from "@/components/data-table";
import { PageHeader, SectionTitle, fmtDate } from "@/components/page-header";
import { ApprovalStatusBadge, Badge } from "@/components/status-badge";
import { AlertMessage } from "@/components/alert-message";
import { DATASETS, getDataset, type DatasetId } from "@/lib/datasets";
import { DEFAULT_BACKUP, getSetting, loadDataset, publishedDetails } from "@/lib/repo";
import type { Row } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "CSVマスター管理" };

const TABS = [
  { id: "import", label: "CSV取込・反映" },
  { id: "versions", label: "マスター版管理" },
  { id: "backup", label: "バックアップ・復元" },
  { id: "data", label: "登録データ閲覧" },
];

export default async function MasterPage({ searchParams }: { searchParams: Promise<{ tab?: string; ds?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.tab) ? sp.tab! : "import";

  return (
    <>
      <PageHeader
        title="CSVマスター管理"
        description="マスターの更新は定型 CSV で行います。アップロード → 形式検証 → 差分確認 → 承認 → 本番反映 の順に進み、未承認のデータが本番に反映されることはありません。"
      />
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="マスター管理メニュー">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/master?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`relative shrink-0 px-4 py-2.5 text-[13px] ${tab === t.id ? "font-bold text-navy" : "text-muted hover:text-ink"}`}
          >
            {t.label}
            {tab === t.id && <span className="absolute right-2 bottom-0 left-2 h-0.5 rounded bg-navy" aria-hidden />}
          </Link>
        ))}
      </nav>
      {tab === "import" && <CSVUploadPanel />}
      {tab === "versions" && <Versions />}
      {tab === "backup" && <Backup />}
      {tab === "data" && <DataBrowser ds={sp.ds} />}
    </>
  );
}

async function Versions() {
  const pub = await publishedDetails();
  return (
    <section className="card overflow-hidden">
      <SectionTitle aside={<Link href="/history" className="btn-secondary btn-sm"><History size={14} aria-hidden /> 承認・更新履歴</Link>}>
        現在の承認版
      </SectionTitle>
      <DataTable
        rows={DATASETS.map((d) => ({ d, v: pub.find((p) => p.dataset === d.id) }))}
        rowKey={(x) => x.d.id}
        columns={[
          {
            key: "name",
            header: "マスター",
            render: ({ d }) => (
              <>
                <div className="font-medium">{d.label}</div>
                <div className="text-xs text-muted">{d.description}</div>
              </>
            ),
          },
          { key: "ver", header: "公開中の版", render: ({ v }) => (v ? <span className="font-mono font-bold text-navy">v{v.version_no}</span> : "—") },
          { key: "status", header: "状態", render: ({ v }) => (v ? <ApprovalStatusBadge status="published" /> : "—") },
          { key: "count", header: "件数", className: "tnum", render: ({ v }) => (v ? `${v.row_count} 件` : "—") },
          { key: "at", header: "最終更新日時", className: "tnum whitespace-nowrap", render: ({ v }) => fmtDate(v?.reviewed_at) },
          { key: "by", header: "承認担当者", render: ({ v }) => v?.reviewed_by ?? "—" },
          {
            key: "act",
            header: "",
            render: ({ d }) => (
              <div className="flex justify-end gap-1.5">
                <a className="btn-secondary btn-sm" href={`/api/master/export?dataset=${d.id}`}>
                  <Download size={13} aria-hidden /> CSV
                </a>
                <Link className="btn-ghost btn-sm" href={`/history?dataset=${d.id}`}>
                  履歴
                </Link>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}

async function Backup() {
  const backup = await getSetting("backup", DEFAULT_BACKUP);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card">
        <SectionTitle>手動バックアップ</SectionTitle>
        <div className="space-y-3 px-5 py-4 text-[13px]">
          <p className="text-muted">全マスター・版履歴・設定を 1 つのファイルとして保存します。別業者への移行時もこのファイルとソースコードで引き継げます。</p>
          <a href="/api/master/backup" className="btn-navy">
            <Archive size={16} aria-hidden /> 全データをバックアップ（JSON）
          </a>
          <div className="border-t border-line pt-3">
            <div className="mb-2 text-xs font-medium text-muted">マスター別の CSV 出力</div>
            <div className="flex flex-wrap gap-1.5">
              {DATASETS.map((d) => (
                <a key={d.id} href={`/api/master/export?dataset=${d.id}`} className="btn-secondary btn-sm">
                  <Download size={13} aria-hidden /> {d.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="card">
        <SectionTitle aside={<Link href="/settings?tab=backup" className="text-xs text-action hover:underline">設定を変更</Link>}>
          自動バックアップ
        </SectionTitle>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 px-5 py-4 text-[13px]">
          <dt className="text-muted">実行頻度</dt>
          <dd>{backup.frequency}</dd>
          <dt className="text-muted">保持期間</dt>
          <dd className="tnum">{backup.retention_days} 日</dd>
          <dt className="text-muted">保存先</dt>
          <dd>{backup.destination}</dd>
          <dt className="text-muted">DB の履歴保持</dt>
          <dd>任意の時点へ戻せるデータベース機能（ポイントインタイム復元）を併用</dd>
        </dl>
      </section>
      <section className="card lg:col-span-2">
        <SectionTitle>旧版への復元</SectionTitle>
        <div className="flex flex-col gap-3 px-5 py-4 text-[13px] md:flex-row md:items-center md:justify-between">
          <p className="text-muted">
            承認済みのすべての版を保存しています。復元は承認者が「承認・更新履歴」から対象の版を選び、影響（差分）を確認したうえで申請し、別の承認者の承認後に反映されます。
          </p>
          <Link href="/history" className="btn-secondary shrink-0">
            <RotateCcw size={15} aria-hidden /> 版を選んで復元する
          </Link>
        </div>
      </section>
    </div>
  );
}

async function DataBrowser({ ds: dsParam }: { ds?: string }) {
  const ds = getDataset(dsParam ?? "") ?? DATASETS[1];
  const rows = await loadDataset(ds.id as DatasetId);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {DATASETS.map((d) => (
          <Link
            key={d.id}
            href={`/master?tab=data&ds=${d.id}`}
            className={`rounded-full px-3 py-1 text-[13px] ${d.id === ds.id ? "bg-navy text-white" : "border border-line bg-surface text-ink/80 hover:border-navy"}`}
          >
            {d.label}
          </Link>
        ))}
      </div>
      <AlertMessage variant="info">
        閲覧専用です。多数項目の直接編集画面は設けず、更新は定型 CSV ＋承認で行います。原表記・正規化値・確認状態・出典を分けて保持しています。
      </AlertMessage>
      <section className="card overflow-hidden">
        <SectionTitle aside={<span className="text-xs text-muted tnum">{rows.length} 件</span>}>{ds.label}</SectionTitle>
        <DataTable<Row>
          rows={rows}
          rowKey={(r) => r[ds.key]}
          maxHeight={560}
          columns={ds.columns.map((c, i) => ({
            key: c.name,
            header: c.label,
            sticky: i === 0 ? { left: 0, width: 110 } : undefined,
            className: c.name === ds.key ? "font-mono text-xs font-medium" : "text-xs",
            render: (r: Row) => {
              const v = r[c.name];
              if (c.name === "status") return <ApprovalStatusBadge status={v} />;
              if (c.type === "bool") return <Badge tone={v ? (c.name === "customer_use" ? "success" : "warning") : "neutral"}>{v ? "はい" : "いいえ"}</Badge>;
              return v === null || v === undefined || v === "" ? <span className="text-subtle">—</span> : String(v);
            },
          }))}
        />
      </section>
    </div>
  );
}
