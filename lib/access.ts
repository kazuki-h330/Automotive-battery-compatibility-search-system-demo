// 閲覧制限（DBJ 様サンプル検証環境用）。ACCESS_PASSWORD が設定された環境だけ有効になる。
// 社内向けデータ（輸入車の適合データ等）を外部から閲覧できないようにするための入口のパスワード。
// Phase 1 の利用者ログイン（個人アカウント・権限）とは別物で、ログイン実装後はそちらに置き換える。

export const ACCESS_COOKIE = "dbj_access";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 30; // 30 日

/** パスワードから cookie 用のトークンを作る（パスワード自体は cookie に入れない） */
export async function accessToken(password: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("dbj-access-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 長さに依存しない比較 */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** ログイン後の戻り先。同一サイト内のパスのみ許可する */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}
