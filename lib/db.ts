import { readFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

// DATABASE_URL があれば Neon（本番想定）、なければ PGlite のインメモリ DB（デモ用、サンプルデータ投入済み）。
// どちらも同じ SQL で動くため、移行時のコード変更は不要。

export type Row = Record<string, any>;
export type Stmt = { text: string; params?: unknown[] };

interface Db {
  mode: "neon" | "demo";
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  transaction(stmts: Stmt[]): Promise<void>;
}

function readSql(name: string) {
  return readFileSync(path.join(process.cwd(), "db", name), "utf8");
}

function neonDb(url: string): Db {
  const sql = neon(url);
  return {
    mode: "neon",
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params)) as T[];
    },
    async transaction(stmts) {
      await sql.transaction(stmts.map((s) => sql.query(s.text, s.params ?? [])));
    },
  };
}

type PGliteLike = {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(text: string): Promise<unknown>;
  transaction<T>(fn: (tx: { query: PGliteLike["query"] }) => Promise<T>): Promise<T>;
};

const g = globalThis as unknown as { __dbjPglite?: Promise<PGliteLike> };

function demoDb(): Db {
  if (!g.__dbjPglite) {
    g.__dbjPglite = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const pg = (await PGlite.create()) as unknown as PGliteLike;
      await pg.exec(readSql("schema.sql"));
      await pg.exec(readSql("seed.sql"));
      return pg;
    })();
  }
  const ready = g.__dbjPglite;
  return {
    mode: "demo",
    async query<T>(text: string, params: unknown[] = []) {
      const pg = await ready;
      return (await pg.query<T>(text, params)).rows;
    },
    async transaction(stmts) {
      const pg = await ready;
      await pg.transaction(async (tx) => {
        for (const s of stmts) await tx.query(s.text, s.params ?? []);
      });
    },
  };
}

let instance: Db | undefined;
export function db(): Db {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    instance = url ? neonDb(url) : demoDb();
  }
  return instance;
}
