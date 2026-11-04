"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { DEMO_ACTORS, ROLE_LABEL, actorPayload, postJson, useActor } from "@/components/actor";
import { AlertMessage } from "@/components/alert-message";
import { SectionTitle } from "@/components/page-header";
import { Badge } from "@/components/status-badge";

export function AccountInfo() {
  const { actor, setActor } = useActor();
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <section className="card">
        <SectionTitle>アカウント情報</SectionTitle>
        <div className="flex items-center gap-4 px-5 py-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-lg font-medium text-white" aria-hidden>
            {actor.name.slice(0, 1)}
          </span>
          <div>
            <div className="text-base font-bold">{actor.name}</div>
            <div className="text-[13px] text-muted">{actor.email}</div>
          </div>
        </div>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2.5 border-t border-line px-5 py-4 text-[13px]">
          <dt className="text-muted">所属</dt>
          <dd>{actor.dept}</dd>
          <dt className="text-muted">権限</dt>
          <dd>
            <Badge tone="navy">{ROLE_LABEL[actor.role]}</Badge>
          </dd>
          <dt className="text-muted">ログイン方式</dt>
          <dd>次段階で実装予定（社内メールアドレスでのログインを想定）</dd>
        </dl>
      </section>
      <section className="card">
        <SectionTitle>利用者の切替（デモ用）</SectionTitle>
        <p className="px-5 pt-3 text-xs text-muted">ログイン機能の実装までは、ここで利用者を切り替えて権限ごとの表示・操作を確認できます。</p>
        <ul className="space-y-1.5 px-5 py-3">
          {DEMO_ACTORS.map((a) => (
            <li key={a.name}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 ${a.name === actor.name ? "border-action bg-action-soft/60" : "border-line hover:bg-canvas"}`}
              >
                <input type="radio" name="actor" className="h-4 w-4 accent-action" checked={a.name === actor.name} onChange={() => setActor(a)} />
                <span className="flex-1 text-[13px]">
                  <span className="font-medium">{a.name}</span>
                  <span className="ml-2 text-muted">{a.dept}</span>
                </span>
                <Badge tone={a.role === "approver" ? "navy" : "neutral"}>{ROLE_LABEL[a.role]}</Badge>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type Backup = { frequency: string; retention_days: number };

export function BackupSettings({ initial }: { initial: Backup }) {
  const { actor } = useActor();
  const [b, setB] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = actor.role === "approver";

  async function save() {
    setBusy(true);
    const r = await postJson("/api/settings", { backup: b, actor: actorPayload(actor) });
    setBusy(false);
    setMsg(r.status === 200 ? { ok: true, text: "バックアップ設定を保存しました" } : { ok: false, text: r.data.error });
  }

  return (
    <section className="card">
      <SectionTitle>自動バックアップ設定</SectionTitle>
      <div className="space-y-4 px-5 py-4">
        {!canEdit && <AlertMessage variant="info">設定の変更は承認者のみ行えます。現在の設定を表示しています。</AlertMessage>}
        {msg && <AlertMessage variant={msg.ok ? "success" : "error"}>{msg.text}</AlertMessage>}
        <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="bk-freq" className="field-label">
              実行頻度
            </label>
            <select id="bk-freq" className="field" value={b.frequency} onChange={(e) => setB({ ...b, frequency: e.target.value })}>
              {["毎日 3:00", "毎週月曜 3:00"].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">日本時間の早朝に自動で保存します（実行時刻は前後する場合があります）</p>
          </div>
          <div>
            <label htmlFor="bk-ret" className="field-label">
              保持期間（日）
            </label>
            <input id="bk-ret" type="number" min={7} max={365} className="field tnum" value={b.retention_days} onChange={(e) => setB({ ...b, retention_days: Number(e.target.value) })} />
            <p className="mt-1 text-xs text-muted">7〜365 日。期間を過ぎたバックアップは自動で削除されます</p>
          </div>
        </fieldset>
      </div>
      <div className="flex justify-end border-t border-line px-5 py-3">
        <button className="btn-primary" onClick={save} disabled={!canEdit || busy}>
          <Save size={15} aria-hidden /> {busy ? "保存中…" : "設定を保存"}
        </button>
      </div>
    </section>
  );
}
