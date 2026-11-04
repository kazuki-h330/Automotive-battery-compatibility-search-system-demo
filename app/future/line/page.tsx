"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Repeat, SendHorizonal, UserRoundCheck } from "lucide-react";
import { postJson } from "@/components/actor";
import { FutureHeader } from "@/components/future-banner";
import { SectionTitle } from "@/components/page-header";
import { Badge } from "@/components/status-badge";
import type { VehicleQuery } from "@/lib/judge";
import { DBJ_SAMPLE } from "@/lib/profile";

type Msg = { from: "user" | "bot" | "system"; text: string; quick?: string[] };
type Ask = "modelCode" | "regYm" | "conditions" | "ocrConfirm" | null;

const USER_ID = "U-demo-0001";
const newEventId = () => `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function parseYm(s: string) {
  const m = s.normalize("NFKC").match(/(\d{4})\D*(\d{1,2})/);
  if (!m) return null;
  const mm = Number(m[2]);
  return mm >= 1 && mm <= 12 ? `${m[1]}-${String(mm).padStart(2, "0")}` : null;
}

const GREETING: Msg = { from: "bot", text: "バッテリー適合のお問い合わせですね。\n車検証の「型式」を入力するか、車検証の写真を送ってください。" };

export default function LinePreview() {
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [log, setLog] = useState<{ eventId: string; lines: string[] }[]>([]);
  const [ask, setAsk] = useState<Ask>("modelCode");
  const [query, setQuery] = useState<VehicleQuery>({ modelCode: "" });
  const [input, setInput] = useState("");
  const [badSig, setBadSig] = useState(false);
  const [failure, setFailure] = useState(false);
  const [last, setLast] = useState<{ eventId: string; payload: any } | null>(null);
  const [ocrDraft, setOcrDraft] = useState<VehicleQuery | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [msgs]);
  // 再読み込み後に前回の引継ぎ状態が残り、無応答に見えるのを防ぐ
  useEffect(() => {
    postJson("/api/line/session", { userId: USER_ID });
  }, []);

  async function sendEvent(payload: any, eventId = newEventId()) {
    setLast({ eventId, payload });
    const r = await postJson("/api/line/event", { ...payload, eventId, userId: USER_ID, signatureValid: !badSig, simulateFailure: failure });
    setLog((l) => [{ eventId, lines: r.data.log ?? [r.data.error] }, ...l]);
    const replies = (r.data.replies ?? []) as { text: string; quickReplies?: string[]; ask?: Ask }[];
    if (replies.length) setMsgs((m) => [...m, ...replies.map((x) => ({ from: "bot" as const, text: x.text, quick: x.quickReplies }))]);
    const nextAsk = replies.find((x) => x.ask)?.ask ?? null;
    setAsk(nextAsk);
    if (!nextAsk) setQuery({ modelCode: "" });
  }

  async function onUserText(text: string) {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { from: "user", text }]);
    setInput("");
    if (ask === "ocrConfirm" && ocrDraft) {
      setOcrDraft(null);
      if (text === "はい") {
        setQuery(ocrDraft);
        return sendEvent({ text, query: ocrDraft });
      }
      setAsk("modelCode");
      setMsgs((m) => [...m, { from: "bot", text: "お手数ですが、車検証の「型式」を入力してください。" }]);
      return;
    }
    let q = { ...query };
    const wantsStaff = /スタッフ|担当者|人と話/.test(text);
    if (wantsStaff) {
      // 追加質問の途中でもスタッフ対応の希望を優先する（サーバー側で引継ぎ）
    } else if (ask === "regYm") {
      const ym = parseYm(text);
      if (!ym) return setMsgs((m) => [...m, { from: "bot", text: "年と月の両方を入力してください（例: 2019-05）。年のみでは判定できません。" }]);
      q.regYm = ym;
    } else if (ask === "conditions") {
      q.conditions = text === "該当なし" ? [] : [text];
    } else {
      q = { modelCode: text };
    }
    setQuery(q);
    await sendEvent({ text, query: q });
  }

  async function sendPhoto() {
    setMsgs((m) => [...m, { from: "user", text: "📷 車検証の写真" }]);
    const fd = new FormData();
    fd.set("sample", "clear");
    const r = await (await fetch("/api/ocr", { method: "POST", body: fd })).json();
    const get = (k: string) => r.fields.find((f: any) => f.key === k)?.value;
    const q: VehicleQuery = { modelCode: get("modelCode"), engineCode: get("engineCode"), regYm: get("regYm") };
    setLog((l) => [{ eventId: "ocr", lines: r.log }, ...l]);
    setOcrDraft(q);
    setAsk("ocrConfirm");
    setMsgs((m) => [...m, { from: "bot", text: `車検証から次の項目を読み取りました。\n型式: ${q.modelCode}\n原動機の型式: ${q.engineCode}\n初度登録年月: ${q.regYm}\nよろしいですか？`, quick: ["はい", "修正する"] }]);
  }

  const quick = msgs[msgs.length - 1]?.quick;

  return (
    <>
      <FutureHeader
        title="LINE受付・検索連携"
        option="拡張 A"
        description="お客様からの LINE の問い合わせを、テキスト入力と選択ボタンで受け付けます。条件が足りない場合は追加で質問し、確認が必要な場合はスタッフへ引き継ぎます。"
        reuse="判定には Phase 1 の共通処理をそのまま使い、受付・引継ぎ部分だけを追加します。"
      />
      <div className="grid items-start gap-6 xl:grid-cols-[380px_1fr]">
        <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[28px] border-[6px] border-ink bg-[#8cabd9] shadow-pop">
          <div className="bg-ink px-4 py-2.5 text-center text-[13px] font-medium text-white">DBJ バッテリー相談</div>
          <div className="h-[440px] space-y-2 overflow-y-auto p-3" aria-live="polite">
            {msgs.map((m, i) =>
              m.from === "system" ? (
                <div key={i} className="mx-auto w-fit rounded-full bg-black/25 px-3 py-0.5 text-[11px] text-white">
                  {m.text}
                </div>
              ) : (
                <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-6 whitespace-pre-wrap ${m.from === "user" ? "bg-[#a6e86b]" : "bg-white"}`}>{m.text}</div>
                </div>
              ),
            )}
            <div ref={endRef} />
          </div>
          {quick && (
            <div className="flex gap-1.5 overflow-x-auto bg-white/70 px-3 py-2">
              {quick.map((q) => (
                <button key={q} onClick={() => onUserText(q)} className="shrink-0 rounded-full border border-[#06c755] bg-white px-3 py-1 text-xs text-[#06a046]">
                  {q}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-center gap-2 bg-white p-2"
            onSubmit={(e) => {
              e.preventDefault();
              onUserText(input);
            }}
          >
            <button type="button" onClick={sendPhoto} className="btn-ghost btn-sm" aria-label="車検証の写真を送る">
              <Camera size={18} />
            </button>
            <input className="field h-8!" value={input} onChange={(e) => setInput(e.target.value)} placeholder="メッセージを入力" aria-label="メッセージ" />
            <button className="btn-ghost btn-sm text-[#06a046]" aria-label="送信">
              <SendHorizonal size={18} />
            </button>
          </form>
        </div>

        <div className="min-w-0 space-y-4">
          <section className="card">
            <SectionTitle>動作確認</SectionTitle>
            <div className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap gap-4 text-[13px]">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" className="h-4 w-4 accent-action" checked={badSig} onChange={(e) => setBadSig(e.target.checked)} /> 不正な署名のリクエスト
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" className="h-4 w-4 accent-action" checked={failure} onChange={(e) => setFailure(e.target.checked)} /> 障害の発生
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-secondary btn-sm"
                  disabled={!last}
                  onClick={async () => {
                    if (!last) return;
                    setMsgs((m) => [...m, { from: "system", text: "LINE から同じイベントが再送されました" }]);
                    await sendEvent(last.payload, last.eventId);
                  }}
                >
                  <Repeat size={14} aria-hidden /> 直前のイベントを再送
                </button>
                <button
                  className="btn-secondary btn-sm"
                  onClick={async () => {
                    await postJson("/api/line/session", { userId: USER_ID });
                    setMsgs((m) => [...m, { from: "system", text: "スタッフ対応を終了し、自動応答を再開" }]);
                    setAsk("modelCode");
                  }}
                >
                  <UserRoundCheck size={14} aria-hidden /> スタッフ対応を終了
                </button>
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setMsgs([GREETING]);
                    setLog([]);
                    setAsk("modelCode");
                    setQuery({ modelCode: "" });
                  }}
                >
                  <RefreshCw size={14} aria-hidden /> 会話をリセット
                </button>
              </div>
              <p className="text-xs text-muted">
                {DBJ_SAMPLE ? (
                  <>
                    入力例: <code className="font-mono">DBA-GT7</code>（回答）・<code className="font-mono">DBA-NSP130</code>（初度登録年月を質問）・
                    <code className="font-mono">3DA-205004</code>（スタッフへ引継ぎ）・「スタッフ」
                  </>
                ) : (
                  <>
                    入力例: <code className="font-mono">3BA-AB10</code>（回答）・<code className="font-mono">5BA-CD20</code>（選択ボタンで質問）・
                    <code className="font-mono">DBA-EF30</code>（初度登録年月を質問）・<code className="font-mono">3BA-JK50</code>（スタッフへ引継ぎ）・「スタッフ」
                  </>
                )}
              </p>
            </div>
          </section>
          <section className="card">
            <SectionTitle>サーバー側の処理内容</SectionTitle>
            <div className="space-y-3 px-5 py-4">
              {log.length === 0 && <p className="text-[13px] text-muted">メッセージを送ると、署名検証・二重回答防止・判定・引継ぎの流れを表示します。</p>}
              {log.map((e, i) => (
                <div key={i} className="border-l-2 border-navy/40 pl-3 text-[13px]">
                  <Badge>{e.eventId}</Badge>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink/85">
                    {e.lines.map((x, j) => (
                      <li key={j}>{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
