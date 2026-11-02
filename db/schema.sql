-- DBJ バッテリー適合検索 スキーマ
-- 公開中マスター（live テーブル）と、版管理（master_versions）を分けて保持する。
-- live テーブルは常に「公開中の版」と一致し、反映は承認後のみ行う。

-- 出典と利用条件
CREATE TABLE IF NOT EXISTS sources (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  kind            text NOT NULL,
  usage_condition text,
  internal_only   boolean NOT NULL DEFAULT true,
  customer_use    boolean NOT NULL DEFAULT false,
  note            text
);

-- 車両条件
CREATE TABLE IF NOT EXISTS vehicles (
  id           text PRIMARY KEY,
  maker        text NOT NULL,
  car_name     text NOT NULL,
  model_code   text NOT NULL,          -- 型式（原表記、接頭辞を含めそのまま保持）
  engine_code  text,
  grade_spec   text,
  conditions   text,                    -- 装備・仕様条件（寒冷地仕様 等）。'|' 区切り
  period_basis text NOT NULL,           -- 初度登録 / 販売 / 製造 / 不明（同じ意味として比較しない）
  period_from  text,                    -- 'YYYY-MM' または 'YYYY'（年のみ）
  period_to    text,
  period_raw   text,                    -- 原文
  status       text NOT NULL,           -- 収集済み / 解析済み / 適合確認済み
  source_id    text NOT NULL REFERENCES sources(id) DEFERRABLE INITIALLY DEFERRED,
  note         text
);
CREATE INDEX IF NOT EXISTS vehicles_model_code_idx ON vehicles (upper(model_code));

-- 搭載バッテリー要件（型式と規格は 1 対 1 にしない）
CREATE TABLE IF NOT EXISTS vehicle_batteries (
  id         text PRIMARY KEY,
  vehicle_id text NOT NULL REFERENCES vehicles(id) DEFERRABLE INITIALLY DEFERRED,
  role       text NOT NULL,             -- 主機 / 補機
  category   text NOT NULL,             -- JIS / JIS EFB / LN / LN EFB / LN AGM
  spec_code  text NOT NULL,             -- 規格表記（正規化値）
  raw_text   text,                      -- 原文
  qty        integer NOT NULL DEFAULT 1,
  condition  text,
  status     text NOT NULL,
  source_id  text NOT NULL REFERENCES sources(id) DEFERRABLE INITIALLY DEFERRED,
  note       text
);

-- 各社商品・仕様（規格表記と商品コードは分離）
CREATE TABLE IF NOT EXISTS products (
  id          text PRIMARY KEY,
  maker       text NOT NULL,
  part_no     text NOT NULL,            -- 原表記
  aliases     text,                     -- 旧品番・別名 '|' 区切り
  category    text NOT NULL,
  spec_code   text NOT NULL,
  size_group  text NOT NULL,
  capacity_ah numeric,
  cca         integer,
  length_mm   integer,
  width_mm    integer,
  height_mm   integer,
  terminal    text,
  hold_down   text,
  application text,
  status      text NOT NULL,            -- 収集済み / 解析済み
  source_id   text NOT NULL REFERENCES sources(id) DEFERRABLE INITIALLY DEFERRED,
  note        text
);

-- 自社商品
CREATE TABLE IF NOT EXISTS own_products (
  part_no     text PRIMARY KEY,
  name        text NOT NULL,
  category    text NOT NULL,
  spec_code   text NOT NULL,
  size_group  text NOT NULL,
  capacity_ah numeric,
  cca         integer,
  length_mm   integer,
  width_mm    integer,
  height_mm   integer,
  terminal    text,
  application text,
  note        text
);

-- 自社商品対応（DBJ が承認したもののみ「自社対応確認済み」）
CREATE TABLE IF NOT EXISTS own_mappings (
  id           text PRIMARY KEY,
  match_type   text NOT NULL,           -- spec（車両要件の規格）/ product（他社商品）
  category     text,
  spec_code    text,
  product_id   text REFERENCES products(id) DEFERRABLE INITIALLY DEFERRED,
  own_part_no  text NOT NULL REFERENCES own_products(part_no) DEFERRABLE INITIALLY DEFERRED,
  direction    text NOT NULL,           -- 双方向 / 置換元→自社
  status       text NOT NULL,           -- 未確認 / 自社対応確認済み
  customer_use boolean NOT NULL DEFAULT false,
  conditions   text,
  source_id    text NOT NULL REFERENCES sources(id) DEFERRABLE INITIALLY DEFERRED,
  approved_by  text,
  approved_at  text,
  note         text
);

-- 版管理：取込・承認・反映・復元
CREATE TABLE IF NOT EXISTS master_versions (
  id            serial PRIMARY KEY,
  dataset       text NOT NULL,
  version_no    integer NOT NULL,
  status        text NOT NULL,          -- pending / published / superseded / rejected
  mode          text NOT NULL,          -- initial / upsert / replace / delete / restore
  file_name     text,
  base_version  integer,                -- 申請時点の公開版（競合検出用）
  restored_from integer,
  summary       jsonb NOT NULL DEFAULT '{}'::jsonb,
  diff          jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot      jsonb NOT NULL,         -- 反映後の全件（バックアップ・復元用）
  submitted_by  text NOT NULL,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_by   text,
  reviewed_at   timestamptz,
  review_note   text,
  UNIQUE (dataset, version_no)
);

-- 回答ログ（画像・個人情報は保存しない）
CREATE TABLE IF NOT EXISTS answer_logs (
  id              serial PRIMARY KEY,
  at              timestamptz NOT NULL DEFAULT now(),
  channel         text NOT NULL,        -- web / line-demo / ocr-demo
  kind            text NOT NULL,        -- vehicle / product
  query           jsonb NOT NULL,
  result_state    text NOT NULL,        -- confirmed / needs_check / not_found
  own_parts       text,
  reasons         jsonb NOT NULL DEFAULT '[]'::jsonb,
  master_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor           text
);

-- 設定（自動返信の一括停止など）
CREATE TABLE IF NOT EXISTS app_settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

-- LINE 連携デモ：再送による二重回答防止とスタッフ引継ぎ
CREATE TABLE IF NOT EXISTS line_events (
  event_id     text PRIMARY KEY,
  received_at  timestamptz NOT NULL DEFAULT now(),
  outcome      text NOT NULL
);
CREATE TABLE IF NOT EXISTS line_sessions (
  user_key   text PRIMARY KEY,           -- ハッシュ化した利用者キー（LINE ユーザー ID 原文は保存しない）
  handoff    boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
