"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/** 破壊的・重要な操作の確認ダイアログ（ネイティブ dialog でフォーカス管理と Esc 閉じに対応） */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = "実行する",
  tone = "primary",
  acknowledge,
  busy = false,
  disabled = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  /** 指定するとチェックを入れるまで実行できない */
  acknowledge?: string;
  busy?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [ack, setAck] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setAck(false);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-0 text-ink shadow-pop"
    >
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        {tone === "danger" && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bad-soft text-bad">
            <AlertTriangle size={16} aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 id="confirm-title" className="text-base font-bold">
            {title}
          </h2>
          {description && <div className="mt-1 text-[13px] text-muted">{description}</div>}
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={onClose} aria-label="閉じる" disabled={busy}>
          <X size={16} />
        </button>
      </div>
      {children && <div className="max-h-[55vh] overflow-y-auto px-5 py-4 text-sm">{children}</div>}
      <div className="flex flex-col-reverse gap-2 border-t border-line bg-canvas px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
        {acknowledge && (
          <label className="mr-auto flex items-center gap-2 text-[13px]">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            {acknowledge}
          </label>
        )}
        <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
          キャンセル
        </button>
        <button
          type="button"
          className={tone === "danger" ? "btn-danger" : "btn-primary"}
          onClick={onConfirm}
          disabled={busy || disabled || (!!acknowledge && !ack)}
          autoFocus={!acknowledge}
        >
          {busy ? "処理中…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
