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
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = { error: `通信エラーが発生しました（${res.status}）` };
  }
  return { status: res.status, data };
}
