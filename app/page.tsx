import Link from "next/link";
import { ArrowRight, Car, ClipboardCheck, FileSpreadsheet, GitCompareArrows, Search } from "lucide-react";
import { AlertMessage } from "@/components/alert-message";
import { DataTable } from "@/components/data-table";
import { PageHeader, SectionTitle, fmtDate } from "@/components/page-header";
import { ApprovalStatusBadge } from "@/components/status-badge";
import { DiffCounts } from "@/components/diff-preview";
import { MODE_LABEL } from "@/lib/csv";
import { DATASETS, getDataset } from "@/lib/datasets";
import { db, type Row } from "@/lib/db";
import { DBJ_SAMPLE } from "@/lib/profile";
import { SampleGuide } from "@/components/sample-guide";
import { publishedDetails } from "@/lib/repo";

export const dynamic = "force-dynamic";

const ACTIONS = [
  { href: "/search/vehicle", icon: Car, title: "車両から検索", desc: "型式・初度登録年月・装備条件から、適合する自社品番と回答文を確認" },
  { href: "/search/battery", icon: Search, title: "バッテリー品番から検索", desc: "現物の品番・旧品番・規格表記から、自社の置換品番を確認" },
  { href: "/compare", icon: GitCompareArrows, title: "メーカー品番比較", desc: "JIS / EFB / LN / AGM の区分ごとに各社品番と自社品番を比較" },
  { href: "/master", icon: FileSpreadsheet, title: "マスター管理", desc: "定型 CSV の取込・検証・差分確認・承認・本番反映" },
];

export default async function Dashboard() {
  const pub = await publishedDetails();
  const recent = await db().query(
    `SELECT id, dataset, version_no, status, mode, file_name, summary, submitted_by, submitted_at, reviewed_by, reviewed_at
       FROM master_versions WHERE mode <> 'initial' ORDER BY submitted_at DESC, id DESC LIMIT 6`,
  );
  const [{ n: pending }] = await db().query(`SELECT count(*)::int AS n FROM master_versions WHERE status = 'pending'`);
  const lastUpdated = pub.map((p) => p.reviewed_at).filter(Boolean).sort((a, b) => +new Date(a) - +new Date(b)).at(-1);

  return (
    <>
      <PageHeader
        title="バッテリー適合検索システム"
        description="車両情報または現物のバッテリー品番から、DBJ が承認した自社取扱品番を検索します。確定回答には承認済みのデータのみを使用します。"
      />

      <form action="/search/vehicle" className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="quick-model" className="field-label">
            車両型式ですぐに検索
          </label>
          <input id="quick-model" name="model" className="field h-10! font-mono" placeholder={`車検証の型式を入力（例: ${DBJ_SAMPLE ? "DBA-NSP130" : "3BA-AB10"}）`} autoComplete="off" required />
        </div>
        <button className="btn-primary h-10!">
          <Search size={16} aria-hidden /> 適合を検索
        </button>
      </form>

      {pending > 0 && (
        <AlertMessage
          variant="warning"
          title={`承認待ちのマスター更新が ${pending} 件あります`}
          className="mb-6"
          action={
            <Link href="/history" className="btn-secondary btn-sm">
              <ClipboardCheck size={14} aria-hidden /> 確認する
            </Link>
          }
        >
          承認されるまで検索結果には反映されません。
        </AlertMessage>
      )}

      {DBJ_SAMPLE && <SampleGuide cases={(await db().query(`SELECT case_id, model_code FROM vehicle_cases ORDER BY id LIMIT 10`)) as { case_id: string; model_code: string }[]} />}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.href} href={a.href} className="card group flex flex-col p-5 transition-colors hover:border-brand-line">
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-charcoal-soft text-charcoal">
                <Icon size={20} aria-hidden />
              </span>
              <span className="text-[15px] font-bold">{a.title}</span>
              <span className="mt-1 flex-1 text-[13px] text-muted">{a.desc}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-brand">
                開く <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <section className="card overflow-hidden">
          <SectionTitle aside={<span className="text-xs text-muted tnum">最終更新 {fmtDate(lastUpdated)}</span>}>マスターの現在の承認版</SectionTitle>
          <DataTable
            rows={DATASETS.map((d) => ({ d, v: pub.find((p) => p.dataset === d.id) }))}
            rowKey={(x) => x.d.id}
            columns={[
              { key: "name", header: "マスター", render: ({ d }) => <span className="font-medium">{d.label}</span> },
              { key: "ver", header: "承認版", render: ({ v }) => (v ? <span className="font-mono font-bold text-charcoal">v{v.version_no}</span> : "—") },
              { key: "n", header: "件数", className: "tnum", render: ({ v }) => (v ? `${v.row_count}` : "—") },
              { key: "at", header: "最終更新日時", className: "tnum whitespace-nowrap text-xs", render: ({ v }) => fmtDate(v?.reviewed_at) },
            ]}
          />
        </section>

        <section className="card overflow-hidden">
          <SectionTitle
            aside={
              <Link href="/history" className="text-xs text-brand hover:underline">
                すべての履歴
              </Link>
            }
          >
            直近の CSV 取込履歴
          </SectionTitle>
          <DataTable<Row>
            rows={recent}
            rowKey={(v) => v.id}
            empty="まだ CSV の取込はありません"
            columns={[
              { key: "at", header: "日時", className: "tnum whitespace-nowrap text-xs", render: (v) => fmtDate(v.reviewed_at ?? v.submitted_at) },
              {
                key: "ds",
                header: "マスター・版",
                render: (v) => (
                  <div className="whitespace-nowrap">
                    {getDataset(v.dataset)?.label} <span className="font-mono text-xs text-charcoal">v{v.version_no}</span>
                  </div>
                ),
              },
              {
                key: "c",
                header: "内容",
                render: (v) => (
                  <div>
                    <div className="text-xs text-muted">
                      {MODE_LABEL[v.mode]?.split("（")[0]} ・ {v.submitted_by}
                    </div>
                    <DiffCounts s={v.summary} compact />
                  </div>
                ),
              },
              { key: "st", header: "状態", render: (v) => <ApprovalStatusBadge status={v.status} /> },
            ]}
          />
        </section>
      </div>
    </>
  );
}
