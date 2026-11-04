// Neon にスキーマとサンプルデータを投入する。
//   npm run db:setup   … テーブル作成（未投入ならサンプルデータも投入）
//   npm run db:reset   … 全テーブルを削除して作り直す（デモの初期化用）
//   --empty            … サンプルデータを入れない（実データ・検証データの取込用）
import { readFileSync, existsSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL が設定されていません（.env.local に記載してください）");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const TABLES = ["backups", "answer_logs", "master_versions", "own_mappings", "own_products", "products", "vehicle_batteries", "vehicles", "sources", "app_settings", "line_events", "line_sessions"];

try {
  if (process.argv.includes("--reset")) {
    await pool.query(`DROP TABLE IF EXISTS ${TABLES.join(", ")} CASCADE`);
    console.log("既存テーブルを削除しました");
  }
  await pool.query(readFileSync("db/schema.sql", "utf8"));
  console.log("スキーマを作成しました");
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM sources");
  if (process.argv.includes("--empty")) {
    console.log("サンプルデータは投入しません（空の DB）");
  } else if (rows[0].n === 0) {
    await pool.query(readFileSync("db/seed.sql", "utf8"));
    console.log("サンプルデータ（架空）を投入しました");
  } else {
    console.log("データが既にあるためサンプル投入をスキップしました");
  }
} finally {
  await pool.end();
}
