import type { Metadata } from "next";
import Link from "next/link";
import { Archive, Check, Minus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { PageHeader, SectionTitle, fmtDate } from "@/components/page-header";
import { ApprovalStatusBadge, Badge, ResultStateBadge } from "@/components/status-badge";
import { getDataset } from "@/lib/datasets";
import { db, type Row } from "@/lib/db";
import { DEFAULT_BACKUP, getSetting, publishedDetails } from "@/lib/repo";
import type { State } from "@/lib/judge";
import { AccountInfo, BackupSettings } from "./client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "システム設定" };

const TABS = [
  { id: "account", label: "アカウント情報" },
  { id: "roles", label: "ユーザー権限" },
  { id: "backup", label: "バックアップ設定" },
  { id: "logs", label: "操作ログ" },
  { id: "system", label: "システム基本情報" },
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; log?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.tab) ? sp.tab! : "account";
  return (
    <>
      <PageHeader title="システム設定" description="アカウント・権限・バックアップ・操作ログ・システムの基本情報を確認します。" />
      <div className="grid items-start gap-6 md:grid-cols-[200px_1fr]">
        <nav aria-label="設定メニュー" className="flex gap-1 overflow-x-auto md:sticky md:top-24 md:flex-col">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/settings?tab=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-[13px] ${tab === t.id ? "bg-navy-soft font-medium text-navy" : "text-ink/80 hover:bg-line-soft"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === "account" && <AccountInfo />}
          {tab === "roles" && <Roles />}
          {tab === "backup" && <BackupSettings initial={await getSetting("backup", DEFAULT_BACKUP)} />}
          {tab === "logs" && <Logs which={sp.log === "master" ? "master" : "search"} />}
          {tab === "system" && <SystemInfo />}
        </div>
      </div>
    </>
  );
}

const PERMS: { label: string; staff: boolean; approver: boolean; viewer: boolean }[] = [
  { label: "車両から検索・バッテリー品番検索", staff: true, approver: true, viewer: true },
  { label: "顧客向け回答文のコピー", staff: true, approver: true, viewer: true },
  { label: "メーカー品番比較の閲覧", staff: true, approver: true, viewer: true },
  { label: "CSV 取込・承認の申請", staff: true, approver: true, viewer: false },
  { label: "承認・本番反映（申請者本人を除く）", staff: false, approver: true, viewer: false },
  { label: "旧版への復元の申請", staff: false, approver: true, viewer: false },
  { label: "バックアップ設定の変更", staff: false, approver: true, viewer: false },
];

function Roles() {
  const users = [
    { name: "山田 健太", dept: "営業サポート課", role: "スタッフ" },
    { name: "中野 誠", dept: "商品管理部", role: "承認者" },
    { name: "佐藤 由美", dept: "商品管理部", role: "承認者" },
    { name: "鈴木 翔", dept: "店舗運営課", role: "閲覧者" },
  ];
  const mark = (v: boolean) => (v ? <Check size={16} className="mx-auto text-ok" aria-label="可" /> : <Minus size={16} className="mx-auto text-subtle" aria-label="不可" />);
  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <SectionTitle>権限ごとにできること</SectionTitle>
        <div className="overflow-x-auto">
          <table className="dt">
            <thead>
              <tr>
                <th>操作</th>
                <th className="text-center!">閲覧者</th>
                <th className="text-center!">スタッフ</th>
                <th className="text-center!">承認者</th>
              </tr>
            </thead>
            <tbody>
              {PERMS.map((p) => (
                <tr key={p.label}>
                  <td>{p.label}</td>
                  <td>{mark(p.viewer)}</td>
                  <td>{mark(p.staff)}</td>
                  <td>{mark(p.approver)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card overflow-hidden">
        <SectionTitle aside={<span className="text-xs text-muted">登録・変更はログイン機能と同時に実装予定</span>}>利用者一覧</SectionTitle>
        <DataTable
          rows={users}
          rowKey={(u) => u.name}
          columns={[
            { key: "name", header: "氏名", render: (u) => <span className="font-medium">{u.name}</span> },
            { key: "dept", header: "所属" },
            { key: "role", header: "権限", render: (u) => <Badge tone={u.role === "承認者" ? "navy" : "neutral"}>{u.role}</Badge> },
          ]}
        />
      </section>
    </div>
  );
}

const CHANNEL: Record<string, string> = { web: "社内画面", "line-demo": "LINE（将来）", "ocr-demo": "OCR（将来）" };

async function Logs({ which }: { which: "search" | "master" }) {
  const search = which === "search" ? await db().query(`SELECT * FROM answer_logs ORDER BY id DESC LIMIT 200`) : [];
  const master =
    which === "master"
      ? await db().query(`SELECT id, dataset, version_no, status, mode, submitted_by, submitted_at, reviewed_by, reviewed_at FROM master_versions ORDER BY id DESC LIMIT 200`)
      : [];
  const events = master.flatMap((v: Row) => [
    ...(v.reviewed_at ? [{ key: `${v.id}r`, at: v.reviewed_at, who: v.reviewed_by, what: v.status === "rejected" ? "差し戻し" : "承認・本番反映", v }] : []),
    { key: `${v.id}s`, at: v.submitted_at, who: v.submitted_by, what: v.mode === "restore" ? "復元の申請" : v.mode === "initial" ? "初期登録" : "CSV 取込の申請", v },
  ]);
  events.sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <h2 className="text-sm font-bold">操作ログ</h2>
        <div className="flex gap-1">
          {[
            ["search", "検索・回答"],
            ["master", "マスター操作"],
          ].map(([k, l]) => (
            <Link
              key={k}
              href={`/settings?tab=logs&log=${k}`}
              className={`rounded-md px-2.5 py-1 text-xs ${which === k ? "bg-navy-soft font-medium text-navy" : "text-muted hover:bg-line-soft"}`}
            >
              {l}
            </Link>
          ))}
        </div>
      </div>
      <p className="border-b border-line px-5 py-2 text-xs text-muted">
        検索条件・判定結果・使用したマスター版を記録します。画像・氏名・LINE ユーザー ID などの個人情報は記録しません。
      </p>
      {which === "search" ? (
        <DataTable<Row>
          rows={search}
          rowKey={(l) => l.id}
          empty="まだ検索の記録はありません"
          maxHeight={560}
          columns={[
            { key: "at", header: "日時", className: "tnum whitespace-nowrap text-xs", render: (l) => fmtDate(l.at) },
            { key: "actor", header: "操作者", className: "whitespace-nowrap", render: (l) => l.actor ?? "—" },
            { key: "ch", header: "経路", className: "text-xs whitespace-nowrap", render: (l) => `${CHANNEL[l.channel] ?? l.channel}・${l.kind === "vehicle" ? "車両" : "品番"}` },
            {
              key: "q",
              header: "検索条件",
              className: "font-mono text-xs",
              render: (l) =>
                Object.entries(l.query as Record<string, unknown>)
                  .filter(([, v]) => v !== undefined && v !== null && v !== "")
                  .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("・") || "なし" : v}`)
                  .join(" "),
            },
            { key: "state", header: "結果", render: (l) => <ResultStateBadge state={l.result_state as State} /> },
            { key: "parts", header: "回答品番", className: "font-mono text-xs", render: (l) => l.own_parts ?? "—" },
            {
              key: "ver",
              header: "マスター版",
              className: "text-xs text-muted whitespace-nowrap",
              render: (l) => `車両 v${l.master_versions.vehicles ?? "-"}・対応 v${l.master_versions.own_mappings ?? "-"}`,
            },
          ]}
        />
      ) : (
        <DataTable
          rows={events}
          rowKey={(e) => e.key}
          maxHeight={560}
          columns={[
            { key: "at", header: "日時", className: "tnum whitespace-nowrap text-xs", render: (e) => fmtDate(e.at) },
            { key: "who", header: "操作者", className: "whitespace-nowrap", render: (e) => e.who },
            { key: "what", header: "操作", render: (e) => e.what },
            { key: "target", header: "対象", render: (e) => `${getDataset(e.v.dataset)?.label} v${e.v.version_no}` },
            { key: "st", header: "現在の状態", render: (e) => <ApprovalStatusBadge status={e.v.status} /> },
          ]}
        />
      )}
    </section>
  );
}

async function SystemInfo() {
  const pub = await publishedDetails();
  const mode = db().mode;
  return (
    <div className="space-y-4">
      <section className="card">
        <SectionTitle>システム基本情報</SectionTitle>
        <dl className="grid grid-cols-[140px_1fr] gap-y-2.5 px-5 py-4 text-[13px] md:grid-cols-[160px_1fr_160px_1fr]">
          <dt className="text-muted">システム名</dt>
          <dd>バッテリー適合検索システム</dd>
          <dt className="text-muted">バージョン</dt>
          <dd className="tnum">0.2.0（Phase 1）</dd>
          <dt className="text-muted">データベース</dt>
          <dd>{mode === "neon" ? "PostgreSQL（Neon）" : "デモ用インメモリ DB"}</dd>
          <dt className="text-muted">判定方式</dt>
          <dd>承認済みマスター＋ルール（生成 AI 不使用）</dd>
          <dt className="text-muted">外部サービス</dt>
          <dd>アプリ実行環境（Vercel）・データベース（Neon）のみ</dd>
          <dt className="text-muted">利用データ</dt>
          <dd>架空の検証データ</dd>
        </dl>
      </section>

      <section className="card overflow-hidden">
        <SectionTitle aside={<a href="/api/master/backup" className="btn-secondary btn-sm"><Archive size={13} aria-hidden /> 全データ出力</a>}>
          マスターの公開版
        </SectionTitle>
        <DataTable
          rows={pub}
          rowKey={(v) => v.dataset}
          columns={[
            { key: "ds", header: "マスター", render: (v) => getDataset(v.dataset)?.label },
            { key: "ver", header: "版", render: (v) => <span className="font-mono font-bold text-navy">v{v.version_no}</span> },
            { key: "n", header: "件数", className: "tnum", render: (v) => `${v.row_count} 件` },
            { key: "at", header: "反映日時", className: "tnum text-xs", render: (v) => fmtDate(v.reviewed_at) },
          ]}
        />
      </section>

      <section className="card">
        <SectionTitle>段階拡張の構成</SectionTitle>
        <div className="grid gap-3 px-5 py-4 md:grid-cols-4">
          {[
            { tag: "Phase 1", title: "社内検索", body: "社内画面・品番比較・CSV マスター管理。共通の判定処理と DB を構築", done: true },
            { tag: "拡張 A", title: "LINE 受付", body: "同じ判定処理を LINE から呼び出し。署名検証・再送防止・スタッフ引継ぎを追加", done: false },
            { tag: "拡張 B", title: "車検証 OCR", body: "画像から技術項目のみを抽出し、利用者が確認・訂正してから判定へ渡す", done: false },
            { tag: "拡張 C", title: "自動返信", body: "承認済みかつ顧客回答可の結果だけを定型返信。一括停止に対応", done: false },
          ].map((p) => (
            <div key={p.tag} className={`rounded-lg border p-3 ${p.done ? "border-navy/30 bg-navy-soft/50" : "border-line"}`}>
              <div className="flex items-center justify-between">
                <Badge tone={p.done ? "navy" : "neutral"}>{p.tag}</Badge>
                <span className={`text-[11px] ${p.done ? "text-navy" : "text-muted"}`}>{p.done ? "実装済み" : "未実装"}</span>
              </div>
              <div className="mt-2 text-[13px] font-bold">{p.title}</div>
              <p className="mt-1 text-xs text-muted">{p.body}</p>
            </div>
          ))}
        </div>
        <p className="border-t border-line px-5 py-3 text-xs text-muted">
          判定処理（車両・品番）は 1 か所に集約しており、拡張 A〜C は入口と送信制御のみを追加します。判定を作り直す必要はありません。
        </p>
      </section>
    </div>
  );
}
