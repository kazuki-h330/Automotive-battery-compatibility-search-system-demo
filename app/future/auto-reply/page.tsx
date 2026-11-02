import type { Metadata } from "next";
import { DataTable } from "@/components/data-table";
import { FutureHeader } from "@/components/future-banner";
import { SectionTitle, fmtDate } from "@/components/page-header";
import { Badge, ResultStateBadge } from "@/components/status-badge";
import { db, type Row } from "@/lib/db";
import { getSetting } from "@/lib/repo";
import { AutoReplyToggle } from "./toggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "自動返信" };

const OUTCOME: Record<string, string> = {
  auto_reply: "自動返信",
  ask_more: "追加質問",
  ask_model: "型式を質問",
  handoff: "スタッフへ引継ぎ",
  handoff_request: "お客様の希望で引継ぎ",
  handoff_autoreply_off: "停止中のため引継ぎ",
  suppressed_handoff: "引継ぎ中のため返信なし",
  failure: "障害時の案内",
  processing: "処理中",
};

const RULES = [
  { state: <ResultStateBadge state="confirmed" />, cond: "必要条件・承認済みの自社対応・顧客回答への利用可がすべて揃っている", action: "定型文で自社品番を自動返信" },
  { state: <Badge tone="info">条件不足</Badge>, cond: "初度登録年月・装備条件など、選択肢で確認できる項目が不足", action: "追加で質問（選択ボタン・入力）" },
  { state: <ResultStateBadge state="needs_check" />, cond: "複数候補・未承認・顧客回答不可の出典・読み取り不確か", action: "スタッフへ引継ぎ（自動返信しない）" },
  { state: <ResultStateBadge state="not_found" />, cond: "車両データまたは自社対応がない", action: "スタッフへ引継ぎ" },
  { state: <Badge>一括停止中</Badge>, cond: "承認者が自動返信を停止している", action: "すべてスタッフへ引継ぎ" },
];

export default async function AutoReplyPreview() {
  const enabled = await getSetting("auto_reply_enabled", true);
  const events = await db().query(`SELECT * FROM line_events ORDER BY received_at DESC LIMIT 20`);

  return (
    <>
      <FutureHeader
        title="自動返信"
        option="拡張 C"
        description="承認済みで顧客回答に利用できる結果に限り、LINE で自社品番を定型文で返信します。それ以外はスタッフへ引き継ぎます。自動返信はいつでも一括停止できます。"
        reuse="判定は Phase 1 の共通処理、送受信は拡張 A を利用し、送信可否の制御だけを追加します。"
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <section className="card overflow-hidden">
            <SectionTitle>返信するかどうかのルール</SectionTitle>
            <DataTable
              rows={RULES.map((r, i) => ({ ...r, i }))}
              rowKey={(r) => r.i}
              columns={[
                { key: "state", header: "判定結果", render: (r) => r.state },
                { key: "cond", header: "条件", render: (r) => r.cond },
                { key: "action", header: "LINE での対応", render: (r) => <span className="font-medium">{r.action}</span> },
              ]}
            />
          </section>
          <section className="card overflow-hidden">
            <SectionTitle>直近の受付（プレビュー）</SectionTitle>
            <DataTable<Row>
              rows={events}
              rowKey={(e) => e.event_id}
              empty="まだ受付がありません。「LINE受付・検索連携」で試せます"
              columns={[
                { key: "at", header: "受信日時", className: "tnum whitespace-nowrap text-xs", render: (e) => fmtDate(e.received_at) },
                { key: "id", header: "受付番号", className: "font-mono text-xs", render: (e) => e.event_id },
                { key: "o", header: "対応", render: (e) => OUTCOME[e.outcome] ?? e.outcome },
              ]}
            />
          </section>
        </div>
        <AutoReplyToggle initial={enabled} />
      </div>
    </>
  );
}
