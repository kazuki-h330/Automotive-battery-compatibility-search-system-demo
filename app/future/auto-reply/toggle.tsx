"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { actorPayload, postJson, useActor } from "@/components/actor";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function AutoReplyToggle({ initial }: { initial: boolean }) {
  const { actor } = useActor();
  const [on, setOn] = useState(initial);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const r = await postJson("/api/settings", { auto_reply_enabled: !on, actor: actorPayload(actor) });
    setBusy(false);
    setConfirm(false);
    if (r.status !== 200) return setErr(r.data.error);
    setErr("");
    setOn(r.data.auto_reply_enabled);
  }

  return (
    <section className="card p-5">
      <div className="text-xs text-muted">自動返信の状態</div>
      <div className="mt-1 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${on ? "bg-ok" : "bg-bad"}`} aria-hidden />
        <span className="text-xl font-bold">{on ? "稼働中" : "一括停止中"}</span>
      </div>
      <button className={`mt-4 w-full ${on ? "btn-secondary text-bad!" : "btn-primary"}`} onClick={() => setConfirm(true)} disabled={actor.role !== "approver"}>
        {on ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
        {on ? "自動返信を一括停止" : "自動返信を再開"}
      </button>
      {actor.role !== "approver" && <p className="mt-2 text-xs text-muted">停止・再開は承認者のみ操作できます</p>}
      {err && <p className="mt-2 text-xs text-bad">{err}</p>}
      <p className="mt-3 text-xs text-muted">誤った登録が見つかった場合やマスターの大量更新時に、ただちに停止できます。</p>
      <ConfirmDialog
        open={confirm}
        tone={on ? "danger" : "primary"}
        title={on ? "自動返信を一括停止しますか？" : "自動返信を再開しますか？"}
        description={on ? "停止中に届いた問い合わせは、すべてスタッフへ引き継がれます。" : "承認済みかつ顧客回答可の結果のみ、自動で返信を再開します。"}
        confirmLabel={on ? "停止する" : "再開する"}
        busy={busy}
        onConfirm={toggle}
        onClose={() => setConfirm(false)}
      />
    </section>
  );
}
