"use client";

import { createContext, useContext, useEffect, useState } from "react";

// 認証は次段階で導入予定。デモではアカウントメニューから利用者（権限）を切り替えて権限の違いを確認できる。
export type Role = "staff" | "approver" | "viewer";
export type Actor = { name: string; role: Role; email: string; dept: string };

export const DEMO_ACTORS: Actor[] = [
  { name: "山田 健太", role: "staff", email: "yamada@dbj.example", dept: "営業サポート課" },
  { name: "中野 誠", role: "approver", email: "nakano@dbj.example", dept: "商品管理部" },
  { name: "佐藤 由美", role: "approver", email: "sato@dbj.example", dept: "商品管理部" },
  { name: "鈴木 翔", role: "viewer", email: "suzuki@dbj.example", dept: "店舗運営課" },
];

export const ROLE_LABEL: Record<Role, string> = { staff: "スタッフ", approver: "承認者", viewer: "閲覧者" };

const Ctx = createContext<{ actor: Actor; setActor: (a: Actor) => void }>({ actor: DEMO_ACTORS[0], setActor: () => {} });

export function ActorProvider({ children }: { children: React.ReactNode }) {
  const [actor, setActorState] = useState<Actor>(DEMO_ACTORS[0]);
  useEffect(() => {
    try {
      const found = DEMO_ACTORS.find((a) => a.name === localStorage.getItem("dbj-actor"));
      if (found) setActorState(found);
    } catch {}
  }, []);
  const setActor = (a: Actor) => {
    setActorState(a);
    try {
      localStorage.setItem("dbj-actor", a.name);
    } catch {}
  };
  return <Ctx.Provider value={{ actor, setActor }}>{children}</Ctx.Provider>;
}

export const useActor = () => useContext(Ctx);

/** API へ送る利用者情報（名前と権限のみ） */
export const actorPayload = (a: Actor) => ({ name: a.name, role: a.role });

export async function postJson<T = any>(url: string, body: unknown): Promise<{ status: number; data: T }> {
  let res: Response;
  try {
    const json = JSON.stringify(body);
    // 大きな CSV（例: DBJ 適合データ 2 万行・約 22MB）は gzip で圧縮して送る（Vercel の 1 リクエスト上限 4.5MB 対策）
    if (json.length > 1_000_000 && typeof CompressionStream !== "undefined") {
      const gz = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Body-Encoding": "gzip" }, body: gz });
    } else if (json.length > 4_000_000) {
      return { status: 0, data: { error: "ファイルが大きいため送信できません（このブラウザは圧縮送信に対応していません。最新の Chrome / Edge でお試しください）" } as T };
    } else res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: json });
  } catch {
    // 通信断でも呼び出し側の処理中表示が残らないよう、エラーとして返す
    return { status: 0, data: { error: "通信できませんでした。接続を確認して再度お試しください" } as T };
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = { error: `通信エラーが発生しました（${res.status}）` };
  }
  return { status: res.status, data };
}
