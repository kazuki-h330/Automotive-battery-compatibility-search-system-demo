import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { VehicleQuery } from "@/lib/judge";
import { getSetting, logAnswer } from "@/lib/repo";
import { searchVehicle } from "@/lib/search";
import { PHOTO_TEXT } from "@/lib/fitment";
import { fail, ok } from "@/lib/api";
import { DBJ_SAMPLE } from "@/lib/profile";

// オプション A（LINE 受付）＋ C（自動返信）のデモ。実運用では LINE Messaging API の Webhook がここに届く。
// 判定は Phase 1 の judgeVehicle をそのまま使い、本処理では「送信可否の制御・引継ぎ・二重回答防止」だけを担う。

const FAILURE_TEXT = "ただいまシステムの不具合により自動でご案内できません。担当者より改めてご連絡いたします。";

type Reply = { text: string; quickReplies?: string[]; ask?: "regYm" | "conditions" | "modelCode" };

export async function POST(req: Request) {
  const body = await req.json();
  const log: string[] = [];
  const replies: Reply[] = [];

  // 1) 署名検証（実運用: X-Line-Signature を Channel Secret で HMAC-SHA256 検証）
  if (body.signatureValid === false) {
    log.push("署名検証 NG → イベントを破棄（返信しない）");
    return ok({ log, replies, dropped: true }, { status: 401 });
  }
  log.push("署名検証 OK");

  // 2) 再送による二重回答防止（webhookEventId を一意キーとして記録）
  const eventId = String(body.eventId ?? "");
  if (!eventId) return fail("eventId が必要です");
  const inserted = await db().query(
    `INSERT INTO line_events (event_id, outcome) VALUES ($1, 'processing') ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
    [eventId],
  );
  if (inserted.length === 0) {
    log.push(`イベント ${eventId} は処理済み（再送）→ 返信しない`);
    return ok({ log, replies, duplicate: true });
  }

  // LINE ユーザー ID の原文は保存せず、ハッシュのみ保持
  const userKey = createHash("sha256").update(String(body.userId ?? "demo")).digest("hex").slice(0, 16);
  const done = async (outcome: string) => {
    await db().query(`UPDATE line_events SET outcome = $2 WHERE event_id = $1`, [eventId, outcome]);
    return ok({ log, replies });
  };

  // 3) 障害時の案内
  if (body.simulateFailure) {
    log.push("判定処理でエラー発生（模擬）→ 障害時の定型案内を返信し、スタッフへ通知");
    replies.push({ text: FAILURE_TEXT });
    return done("failure");
  }

  // 4) スタッフ引継ぎ中は自動返信を抑止
  const [session] = await db().query(`SELECT handoff FROM line_sessions WHERE user_key = $1`, [userKey]);
  if (session?.handoff) {
    log.push("このユーザーはスタッフ対応中 → 自動返信を抑止（既存の LINE 管理画面でスタッフが対応）");
    return done("suppressed_handoff");
  }
  const handoff = async (why: string) => {
    await db().query(
      `INSERT INTO line_sessions (user_key, handoff) VALUES ($1, true)
       ON CONFLICT (user_key) DO UPDATE SET handoff = true, updated_at = now()`,
      [userKey],
    );
    log.push(`スタッフへ引継ぎ: ${why}`);
    replies.push({ text: "確認のため担当スタッフにおつなぎします。回答まで少々お待ちください。" });
  };

  if (/スタッフ|担当者|人と話/.test(String(body.text ?? ""))) {
    await handoff("利用者がスタッフ対応を希望");
    return done("handoff_request");
  }

  const q: VehicleQuery = body.query ?? {};
  if (!q.modelCode) {
    replies.push({ text: `車検証に記載の「型式」を入力してください（例: ${DBJ_SAMPLE ? "DBA-NSP130" : "3BA-AB10"}）。\n画像で送る場合は車検証の写真を送信してください。`, ask: "modelCode" });
    return done("ask_model");
  }

  // 5) 共通判定処理
  // 判定に失敗しても無応答にせず、障害時の案内を返す（再送は二重回答防止で破棄されるため）
  let result;
  try {
    result = await searchVehicle(q);
    await logAnswer("line-demo", result);
  } catch (e) {
    console.error(e);
    log.push("判定処理でエラー発生 → 障害時の定型案内を返信し、スタッフへ通知");
    replies.push({ text: FAILURE_TEXT });
    return done("failure");
  }
  log.push(`共通判定: ${result.state}（${result.headline}）`);

  // 5-2) 現車確認（DBJ 適合データ）：適合品は返さず、表示文（ラベル写真のお願い）を送ってスタッフに引き継ぐ
  if (result.photoRequest || (result.options?.length && result.options.every((o) => o.key === "currentBattery"))) {
    replies.push({ text: result.customerText ?? PHOTO_TEXT });
    await handoff(`現車確認（ラベル写真の受付）: ${result.headline}`);
    return done("photo_request");
  }

  // 6) 追加質問で解消できる不足は質問する（オプション A）
  // DBJ 適合データで回答が分かれる場合は「仕様」を選択肢で確認する（他の項目はスタッフへ）
  if (result.state === "needs_check" && result.options?.length) {
    const opt = result.options.find((o) => o.key === "variant");
    if (!opt) {
      await handoff(`${result.options.map((o) => o.label).join("・")}で回答が分かれる`);
      return done("handoff");
    }
    replies.push({ text: "お車の仕様を選んでください。", quickReplies: opt.values.map((v) => v || "記載なし"), ask: "conditions" });
    log.push(`回答が分かれる → 仕様を追加質問（${opt.values.length} 通り）`);
    return done("ask_more");
  }
  if (result.state === "needs_check" && result.missing.length) {
    const m = result.missing[0];
    if (m.startsWith("装備条件")) {
      const opts = [...new Set(result.candidates.flatMap((c) => String(c.conditions ?? "").split("|").filter(Boolean)))];
      replies.push({ text: `お車の仕様を選んでください。`, quickReplies: [...opts, "該当なし"], ask: "conditions" });
    } else if (m === "初度登録年月") {
      replies.push({ text: "車検証の「初度登録年月」を入力してください（例: 2019-05）。", ask: "regYm" });
    } else {
      await handoff(`不足項目「${m}」は選択肢で確認できない`);
      return done("handoff");
    }
    log.push(`不足項目「${m}」→ 追加質問`);
    return done("ask_more");
  }

  // 7) 自動返信の可否（オプション C）
  const autoOn = await getSetting("auto_reply_enabled", true);
  if (result.state === "confirmed" && result.answer) {
    if (!autoOn) {
      await handoff("自動回答が一括停止中");
      return done("handoff_autoreply_off");
    }
    log.push("承認済み・顧客回答利用可 → 定型文で自動返信");
    replies.push({ text: result.answer.template });
    return done("auto_reply");
  }
  await handoff(result.reasons[0] ?? result.headline);
  return done("handoff");
}
