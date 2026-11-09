"use client";

import { useState } from "react";
import { Archive, Download } from "lucide-react";
import { actorPayload, postJson, useActor } from "./actor";
import { AlertMessage } from "./alert-message";
import { DataTable } from "./data-table";
import { fmtDate, SectionTitle } from "./page-header";
import { Badge } from "./status-badge";

type Backup = { id: number; at: string; trigger_type: string; actor: string | null; row_count: number };

export function BackupList({ initial }: { initial: Backup[] }) {
  const { actor } = useActor();
  const [list, setList] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    const r = await postJson("/api/master/backups", { actor: actorPayload(actor) });
    setBusy(false);
    if (r.status !== 200) return setMsg({ ok: false, text: r.data.error });
    setList(r.data.backups);
    setMsg({ ok: true, text: "バックアップを作成しました" });
  }

  return (
    <section className="card overflow-hidden lg:col-span-2">
      <SectionTitle
        aside={
          <button className="btn-secondary btn-sm" onClick={run} disabled={busy || actor.role !== "approver"} title={actor.role !== "approver" ? "承認者のみ操作できます" : undefined}>
            <Archive size={13} aria-hidden /> {busy ? "作成中…" : "今すぐバックアップ"}
          </button>
        }
      >
        保存済みのバックアップ
      </SectionTitle>
      {msg && (
        <div className="px-5 pt-3">
          <AlertMessage variant={msg.ok ? "success" : "error"}>{msg.text}</AlertMessage>
        </div>
      )}
      <DataTable<Backup>
        rows={list}
        rowKey={(b) => b.id}
        empty="まだバックアップはありません（毎日 3:00 に自動で作成します）"
        columns={[
          { key: "at", header: "作成日時", className: "tnum whitespace-nowrap text-xs", render: (b) => fmtDate(b.at) },
          { key: "kind", header: "種別", render: (b) => <Badge tone={b.trigger_type === "scheduled" ? "charcoal" : "neutral"}>{b.trigger_type === "scheduled" ? "自動" : "手動"}</Badge> },
          { key: "who", header: "実行者", className: "whitespace-nowrap", render: (b) => b.actor ?? "システム" },
          { key: "n", header: "件数", className: "tnum", render: (b) => `${b.row_count} 件` },
          {
            key: "dl",
            header: <span className="sr-only">取得</span>,
            render: (b) => (
              <a className="btn-ghost btn-sm" href={`/api/master/backups/${b.id}`}>
                <Download size={13} aria-hidden /> JSON
              </a>
            ),
          },
        ]}
      />
    </section>
  );
}
