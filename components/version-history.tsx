"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Eye, RotateCcw, Undo2, X } from "lucide-react";
import { actorPayload, postJson, useActor } from "./actor";
import { AlertMessage } from "./alert-message";
import { ConfirmDialog } from "./confirm-dialog";
import { DataTable } from "./data-table";
import { DiffCounts, DiffPreview } from "./diff-preview";
import { EmptyState } from "./empty-state";
import { LoadingSkeleton } from "./loading-skeleton";
import { fmtDate } from "./page-header";
import { ApprovalStatusBadge, Badge } from "./status-badge";
import { DATASETS, getDataset } from "@/lib/datasets";
import { MODE_LABEL } from "@/lib/csv";

type Version = {
  id: number;
  dataset: string;
  version_no: number;
  status: string;
  mode: string;
  file_name: string | null;
  base_version: number | null;
  restored_from: number | null;
  summary: { added: number; changed: number; deleted: number; total: number };
  submitted_by: string;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

const modeLabel = (m: string) => MODE_LABEL[m]?.split("（")[0] ?? m;

function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(920px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-0 text-ink shadow-pop">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="text-base font-bold">{title}</h2>
        <button className="btn-ghost btn-sm" onClick={onClose} aria-label="閉じる">
          <X size={16} />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-canvas px-5 py-3">{footer}</div>}
    </dialog>
  );
}

export function VersionHistory({ initialDataset = "" }: { initialDataset?: string }) {
  const { actor } = useActor();
  const [dataset, setDataset] = useState(initialDataset);
  const [status, setStatus] = useState("");
  const [list, setList] = useState<Version[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [detail, setDetail] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [approveTarget, setApproveTarget] = useState<Version | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<{ v: Version; preview: any } | null>(null);

  const reload = useCallback(async () => {
    try {
      const r = await fetch(`/api/master/versions${dataset ? `?dataset=${dataset}` : ""}`, { cache: "no-store" });
      if (!r.ok) throw new Error();
      setList(await r.json());
      setLoadError("");
    } catch {
      setLoadError("履歴を取得できませんでした");
    }
  }, [dataset]);
  useEffect(() => {
    reload();
  }, [reload]);

  async function openDetail(v: Version) {
    setNote("");
    setDetail({ ...v, loading: true });
    setDetail(await (await fetch(`/api/master/versions/${v.id}`)).json());
  }

  async function act(v: Version, action: "approve" | "reject") {
    setBusy(true);
    const r = await postJson(`/api/master/versions/${v.id}`, { action, actor: actorPayload(actor), note });
    setBusy(false);
    setApproveTarget(null);
    setDetail(null);
    setMsg(r.status === 200 ? { ok: true, text: action === "approve" ? `${getDataset(v.dataset)?.label} v${v.version_no} を承認し、本番に反映しました。` : `v${v.version_no} を差し戻しました。` } : { ok: false, text: r.data.error });
    reload();
  }

  async function startRestore(v: Version) {
    setBusy(true);
    const preview = await (await fetch(`/api/master/versions/${v.id}?preview=restore`)).json();
    setBusy(false);
    setDetail(null);
    setRestoreTarget({ v, preview });
  }

  async function doRestore() {
    if (!restoreTarget) return;
    setBusy(true);
    const r = await postJson(`/api/master/versions/${restoreTarget.v.id}`, { action: "restore", actor: actorPayload(actor) });
    setBusy(false);
    setRestoreTarget(null);
    setMsg(
      r.status === 200
        ? { ok: true, text: `復元を申請しました（v${restoreTarget.v.version_no} の内容 → 新しい版 v${r.data.version.version_no}）。別の承認者の承認後に反映されます。` }
        : { ok: false, text: r.data.error ?? r.data.errors?.map((e: any) => e.message).join(" / ") },
    );
    reload();
  }

  const pending = list?.filter((v) => v.status === "pending") ?? [];
  const rows = (list ?? []).filter((v) => !status || v.status === status);
  const isApprover = actor.role === "approver";

  return (
    <div className="space-y-5">
      {msg && (
        <AlertMessage variant={msg.ok ? "success" : "error"} action={<button className="btn-ghost btn-sm" onClick={() => setMsg(null)} aria-label="閉じる"><X size={14} /></button>}>
          {msg.text}
        </AlertMessage>
      )}
      {loadError && <AlertMessage variant="error" title="読み込みエラー">{loadError}</AlertMessage>}

      {pending.length > 0 && (
        <section className="card overflow-hidden border-warn-line">
          <div className="flex items-center justify-between border-b border-line bg-warn-soft px-5 py-3">
            <h2 className="text-sm font-bold">承認待ち {pending.length} 件</h2>
            {!isApprover && <span className="text-xs text-muted">承認は承認者のみ可能です</span>}
          </div>
          <ul className="divide-y divide-line-soft">
            {pending.map((v) => (
              <li key={v.id} className="flex flex-col gap-3 px-5 py-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="font-medium">{getDataset(v.dataset)?.label}</span>
                    <span className="font-mono text-navy">v{v.version_no}</span>
                    <Badge tone="navy">{modeLabel(v.mode)}</Badge>
                    {v.restored_from && <span className="text-xs text-muted">v{v.restored_from} から復元</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                    <span>申請: {v.submitted_by}</span>
                    <span className="tnum">{fmtDate(v.submitted_at)}</span>
                    <DiffCounts s={v.summary} compact />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary btn-sm" onClick={() => openDetail(v)}>
                    <Eye size={14} aria-hidden /> 差分を確認
                  </button>
                  <button
                    className="btn-primary btn-sm"
                    disabled={!isApprover || v.submitted_by === actor.name}
                    title={v.submitted_by === actor.name ? "申請者本人は承認できません" : undefined}
                    onClick={() => setApproveTarget(v)}
                  >
                    <Check size={14} aria-hidden /> 承認
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-sm font-bold">更新履歴</h2>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="h-ds">
              マスター
            </label>
            <select id="h-ds" className="field h-8! w-auto! text-xs" value={dataset} onChange={(e) => setDataset(e.target.value)}>
              <option value="">すべてのマスター</option>
              {DATASETS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="h-st">
              承認状態
            </label>
            <select id="h-st" className="field h-8! w-auto! text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">すべての状態</option>
              <option value="published">公開中</option>
              <option value="pending">承認待ち</option>
              <option value="superseded">旧版</option>
              <option value="rejected">差戻し</option>
            </select>
          </div>
        </div>
        {!list ? (
          <LoadingSkeleton variant="table" />
        ) : (
          <DataTable<Version>
            rows={rows}
            rowKey={(v) => v.id}
            empty="該当する履歴はありません"
            columns={[
              { key: "at", header: "更新日時", className: "tnum whitespace-nowrap text-xs", render: (v) => fmtDate(v.reviewed_at ?? v.submitted_at) },
              {
                key: "ver",
                header: "マスター版",
                render: (v) => (
                  <div className="whitespace-nowrap">
                    <div className="text-[13px]">{getDataset(v.dataset)?.label}</div>
                    <div className="font-mono text-xs font-bold text-navy">v{v.version_no}</div>
                  </div>
                ),
              },
              { key: "by", header: "操作担当者", className: "whitespace-nowrap", render: (v) => v.submitted_by },
              { key: "rv", header: "承認担当者", className: "whitespace-nowrap", render: (v) => v.reviewed_by ?? <span className="text-subtle">—</span> },
              {
                key: "content",
                header: "更新内容",
                render: (v) => (
                  <div>
                    <div className="text-xs">
                      {modeLabel(v.mode)}
                      {v.restored_from ? `（v${v.restored_from} の内容）` : ""}
                      {v.file_name && <span className="text-muted"> ・ {v.file_name}</span>}
                    </div>
                    <DiffCounts s={v.summary} compact />
                  </div>
                ),
              },
              { key: "status", header: "承認状態", render: (v) => <ApprovalStatusBadge status={v.status} /> },
              {
                key: "detail",
                header: <span className="sr-only">詳細</span>,
                render: (v) => (
                  <button className="btn-ghost btn-sm" onClick={() => openDetail(v)}>
                    詳細
                  </button>
                ),
              },
            ]}
          />
        )}
      </section>

      {/* 詳細 */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${getDataset(detail.dataset)?.label ?? ""} v${detail.version_no ?? ""}` : ""}
        footer={
          detail &&
          !detail.loading && (
            <>
              <a className="btn-secondary mr-auto" href={`/api/master/export?version=${detail.id}`}>
                <Download size={15} aria-hidden /> この版を CSV 出力
              </a>
              {detail.status === "pending" && (
                <>
                  <input className="field w-full! sm:w-64!" placeholder="コメント（任意）" value={note} onChange={(e) => setNote(e.target.value)} aria-label="コメント" />
                  <button className="btn-secondary" disabled={!isApprover || busy} onClick={() => act(detail, "reject")}>
                    <Undo2 size={15} aria-hidden /> 差し戻す
                  </button>
                  <button className="btn-primary" disabled={!isApprover || detail.submitted_by === actor.name || busy} onClick={() => setApproveTarget(detail)}>
                    <Check size={15} aria-hidden /> 承認して反映
                  </button>
                </>
              )}
              {detail.status === "superseded" && (
                <button className="btn-navy" disabled={!isApprover || busy} onClick={() => startRestore(detail)} title={!isApprover ? "復元は承認者のみ操作できます" : undefined}>
                  <RotateCcw size={15} aria-hidden /> この版に復元…
                </button>
              )}
            </>
          )
        }
      >
        {detail?.loading ? (
          <LoadingSkeleton variant="table" />
        ) : (
          detail && (
            <div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-5 py-4 text-[13px] md:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted">承認状態</dt>
                  <dd className="mt-0.5">
                    <ApprovalStatusBadge status={detail.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">更新方式</dt>
                  <dd>{modeLabel(detail.mode)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">操作担当者</dt>
                  <dd>
                    {detail.submitted_by}
                    <div className="text-xs text-muted tnum">{fmtDate(detail.submitted_at)}</div>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">承認担当者</dt>
                  <dd>
                    {detail.reviewed_by ?? "—"}
                    <div className="text-xs text-muted tnum">{detail.reviewed_at ? fmtDate(detail.reviewed_at) : ""}</div>
                  </dd>
                </div>
                {detail.review_note && (
                  <div className="col-span-2 md:col-span-4">
                    <dt className="text-xs text-muted">コメント</dt>
                    <dd>{detail.review_note}</dd>
                  </div>
                )}
              </dl>
              <div className="border-t border-line px-5 py-3">
                <div className="mb-2 text-[13px] font-bold">
                  差分（v{detail.base_version ?? "—"} からの変更）
                </div>
                <DiffCounts s={detail.summary} />
              </div>
              <div className="border-t border-line">
                <DiffPreview diff={detail.diff ?? []} dataset={detail.dataset} />
              </div>
            </div>
          )
        )}
      </Modal>

      <ConfirmDialog
        open={!!approveTarget}
        title="本番データに反映しますか？"
        description={approveTarget ? `${getDataset(approveTarget.dataset)?.label} を v${approveTarget.version_no} に更新します。反映後は直ちに検索結果へ影響します。` : ""}
        confirmLabel="承認して反映する"
        acknowledge="差分の内容を確認しました"
        busy={busy}
        onConfirm={() => approveTarget && act(approveTarget, "approve")}
        onClose={() => setApproveTarget(null)}
      >
        {approveTarget && <DiffCounts s={approveTarget.summary} />}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!restoreTarget}
        tone="danger"
        title="旧版への復元を申請しますか？"
        description={
          restoreTarget
            ? `${getDataset(restoreTarget.v.dataset)?.label} を v${restoreTarget.v.version_no} の内容に戻します（現在の公開版: v${restoreTarget.preview.current}）。`
            : ""
        }
        confirmLabel="復元を申請する"
        acknowledge="対象の版と影響を確認しました"
        disabled={!restoreTarget?.preview.ok}
        busy={busy}
        onConfirm={doRestore}
        onClose={() => setRestoreTarget(null)}
      >
        {restoreTarget && (
          <div className="space-y-3">
            <div className="text-[13px] font-bold">復元した場合の影響（現在の公開データとの差分）</div>
            <DiffCounts s={restoreTarget.preview.summary} />
            {!restoreTarget.preview.ok && (
              <AlertMessage variant="error" title="この版には復元できません">
                {restoreTarget.preview.errors.slice(0, 3).map((e: any) => e.message).join(" / ")}
              </AlertMessage>
            )}
            <div className="overflow-hidden rounded-lg border border-line">
              {restoreTarget.preview.diff.length ? <DiffPreview diff={restoreTarget.preview.diff} dataset={restoreTarget.v.dataset} /> : <EmptyState title="現在のデータと同じ内容です" compact />}
            </div>
            <p className="text-xs text-muted">復元は新しい版として申請され、申請者以外の承認者が承認した時点で反映されます。</p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
