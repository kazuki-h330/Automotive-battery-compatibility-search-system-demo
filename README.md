# DBJ バッテリー適合検索（デモ）

株式会社ディスカバーバッテリージャパン様向け「自動車バッテリー適合検索システム」のデモ実装です。
要件書 Ver 3.2 の Phase 1 全機能と、追加オプション A / B / C の動作イメージを 1 つのアプリで確認できます。
データはすべて架空のサンプルです。

## 構成

| 層 | 採用 | 備考 |
| --- | --- | --- |
| 画面・API | Next.js 16（React 19, App Router） | Vercel にデプロイ |
| DB | Neon（PostgreSQL） | 標準 SQL のみ使用。他社 PostgreSQL へ移行可 |
| 判定 | `lib/judge.ts`（ルールベース） | 生成 AI 不使用。Web / LINE / OCR で共通利用 |
| CSV 検証 | `lib/csv.ts` | 形式・必須・参照整合・差分。部分取込なし |

`DATABASE_URL` が未設定の場合は、PGlite（インメモリの PostgreSQL）にサンプルデータを入れて起動します。
この状態では再起動やサーバーレスのインスタンス切替でデータが初期化されるため、Vercel デモでは Neon を設定してください。

## セットアップ

```bash
npm install
cp .env.example .env.local   # DATABASE_URL に Neon の pooled 接続文字列を設定
npm run db:setup             # スキーマ作成 + サンプルデータ投入
npm run dev                  # http://localhost:3000
```

デモデータを初期状態に戻す: `npm run db:reset`

## Vercel へのデプロイ

1. このフォルダを GitHub にプッシュし、Vercel で Import（Framework: Next.js）
2. Vercel の Storage → Neon を接続するか、Neon で作成した `DATABASE_URL` を Environment Variables に設定
3. ローカルから同じ `DATABASE_URL` で `npm run db:setup` を 1 回実行
4. Deploy

## 画面一覧

| 画面 | パス | 区分 |
| --- | --- | --- |
| ダッシュボード | `/` | Phase 1 |
| 車両から検索 | `/search/vehicle` | Phase 1 |
| バッテリー品番検索 | `/search/battery` | Phase 1 |
| メーカー品番比較 | `/compare` | Phase 1 |
| CSVマスター管理（取込・版管理・バックアップ・閲覧） | `/master` | Phase 1 |
| 承認・更新履歴（承認・差分・復元） | `/history` | Phase 1 |
| システム設定（アカウント・権限・バックアップ・操作ログ・基本情報） | `/settings` | Phase 1 |
| LINE受付・検索連携 | `/future/line` | 将来拡張 A（未実装・プレビュー） |
| 車検証OCR受付 | `/future/ocr` | 将来拡張 B（未実装・プレビュー） |
| 自動返信 | `/future/auto-reply` | 将来拡張 C（未実装・プレビュー） |

ログイン機能は未実装です。ヘッダー右上のアカウントメニューで利用者（スタッフ / 承認者 / 閲覧者）を切り替えると、
承認権限・申請者本人の承認禁止・復元権限などを確認できます。

UI 部品は `components/` に集約しています（AppSidebar, AppHeader, PageHeader, SearchForm, DataTable, ComparisonTable,
ApprovalStatusBadge, ResultCard, AlertMessage, EmptyState, LoadingSkeleton, ConfirmDialog, CSVUploadPanel, DiffPreview, VersionHistory）。

## デモの流れ（例）

1. 車両検索で「自社対応 未承認」（`3BA-JK50`）→ 確認要になることを確認
2. CSV 取込で「LN3 EFB の自社対応を承認済みに更新」を読み込み → 検証 → 承認申請（スタッフ）
3. 利用者を「中野 誠（承認者）」に切り替え → 同じ画面で「承認して本番に反映」
4. 再度 `3BA-JK50` を検索 → 確認済み・回答可に変わる
5. 承認・更新履歴で旧版の「詳細 → この版に復元」→ 影響を確認して申請 → 「佐藤 由美（承認者）」で承認

## DBJ 形式 CSV の変換（データ移行）

DBJ 様の横長 CSV（1 行 = 1 バッテリー要件）を、定型 CSV（sources / own_products / vehicles / vehicle_batteries / own_mappings / vehicle_cases）に変換します。
画面の「CSVマスター管理」にそのままアップロードしても同じ変換が行われます（変換処理は `lib/flat.ts` に集約）。

```bash
npm run data:convert -- <入力CSV> <出力フォルダ> [--basis 初度登録] [--test]
```

`--test`（画面では「テスト用として取り込む」）は、DBJ 様の検証用サンプル向けです。元データの status・customer_reply_allowed にかかわらず全行を出典 `SRC-DBJ-TEST`（顧客回答不可）で登録し、自社商品・対応表は作りません。「確認済み」の行も「解析済み」として登録します（元の status・回答可否は要件の備考に残します）。ID は `TV…` / `TB…` で始まり、承認済みデータを上書きしません。実車確認記録の行は取り込みません。ファイル名に「テスト」「サンプル」「検証」等を含む 19 列 CSV は、画面で初期選択になります。本番データの取込前に削除します。

正式な 19 列（2026-11 DBJ 様ご回答④、固定順・すべて文字列、UTF-8 BOM 付き・CRLF が基本）:

`id, vehicle_maker, car_name, model_code, model_year, engine_code, spec_note, battery_type_spec, battery_position, quantity, required_battery_code, dbj_product_code, status, customer_reply_allowed, Source_note, approved_by, approved_at, type_specification_no, classification_no`

拡張列（任意・19 列の後ろ）: `is_single_vehicle_case`, `is_general_fitment`（TRUE / FALSE / 空欄）

| is_single_vehicle_case | is_general_fitment | 扱い |
| --- | --- | --- |
| TRUE | FALSE / 空欄 | 実車確認記録（`vehicle_cases`）。管理ID がなければ `DBJ-ROW-<id>` で登録し警告 |
| FALSE / 空欄 | TRUE | 汎用適合。自動回答は「確認済み・customer_reply_allowed = TRUE・承認者あり」の行のみ |
| FALSE | FALSE | 社内参考として車両マスターに登録（顧客回答不可・対応表なし） |
| TRUE | TRUE | エラー |
| 空欄 | 空欄 | 従来どおり備考（管理ID・「1 台限定」等）から判定 |

**未承認の行（status が確認済み以外、または customer_reply_allowed = FALSE、またはテスト取込）は、不備があっても社内参考として取り込み、警告にまとめます**（DBJ 様の汎用適合サンプル 40 件の形式に対応）。確認済み・回答可の行は従来どおりエラーにします。

- battery_type_spec が空欄 → 規格表記の形式から区分を判定（JIS 形式 → JIS、K-42 等 → JIS EFB、LN → LN / LN EFB / LN AGM）
- required_battery_code が空欄・解析できない表記（Li-ion 等）→ 搭載要件は登録せず車両のみ（原文は車両の備考）
- model_code が空欄 → 取り込まない（型式で検索できないため）
- 1 セルに複数の型式（「LBA-PG20, LBA-PG20G」）→ 型式ごとに車両を登録
- battery_position が空欄 → 用途「未確定」（主機と推測しない。判定では確定しない）。「Aux, LN1 50Ah AGM」は補機
- spec_note が説明文（「動力区分:ガソリン; 排気量cc:660」等）→ 装備条件の選択肢にせず「グレード・仕様」として表示
- LN の容量付き表記（LN4 80Ah AGM）は規格 LN4・区分 LN AGM とし、原文を保持

### 閲覧制限

環境変数 `ACCESS_PASSWORD` を設定した環境（DBJ 様サンプル検証環境）では、全画面・API に入口のパスワードを求めます（`proxy.ts`、cookie は HttpOnly・30 日、検索エンジン除外）。Vercel Cron と LINE Webhook は対象外です。利用者ログイン（Phase 1）の実装後に置き換えます。

フラグと備考が矛盾する場合（汎用 = TRUE なのに備考に管理ID 等）はエラーにします。列の並びが正式順と異なる場合・customer_reply_allowed が TRUE / FALSE 以外・approved_at が YYYY-MM-DD 以外の場合は警告を出します。

`report.md` にエラーと要確認事項を出力します。エラーがある場合は取込用 CSV を出力しません。

| 形式 | 列 | 扱い |
| --- | --- | --- |
| 19 列（本番） | 11 列 ＋ car_name / spec_note / battery_position / quantity / approved_by / approved_at / type_specification_no / classification_no | 同じ車両条件の行を 1 台にまとめ、主機・補機を要件として登録。車両・対応の ID は内容から決めるため、分割取込でも同じ ID |
| 11 列（サンプル） | id〜customer_reply_allowed | 車名・承認者などは仮の値。サンプル検証環境用 |

- **規格→自社品番の対応**は、確認済み・顧客回答可・承認者ありの行からのみ作成します。対応は全車両で共有されるため、条件不足・未登録の行で下げません（その車両は車両の確認状態で回答を止め、品番は要件の備考に社内参考として残します）。
- **実車確認記録**：備考に管理ID（`DBJ-CASE-…`）や「1 台限定」「汎用適合マスターへの取込は禁止」の記載がある行は、汎用の適合データに入れず `vehicle_cases` に登録します。型式検索・管理ID検索で参考表示しますが、確定回答・自動返信には使いません。拡張列 `is_single_vehicle_case` / `is_general_fitment` で明示できます（旧仕様の `record_scope` も互換のため受け付けます）。型式指定番号・類別区分番号が一致しても、記録の車両と同一とは判定せず「要確認（スタッフ判断）」とします（DBJ 様ご回答③で正式採用）。
- **規格区分**：JIS / JIS EFB / LN / LN EFB / LN AGM / DIN / DIN EFB / DIN AGM / EN / EN EFB / EN AGM。DIN・EN の規格表記は原表記を正規化して保持し、LN 等へ読み替えません。
- 確認済み・顧客回答可の行は、年式（期間）と approved_by・approved_at が必須です。
- 1 回の取込は約 4MB まで（Vercel の送信上限）。車両データで約 2 万行が目安です。それ以上はメーカー別などに分けます。

### 判定ルール（DBJ 様ご回答による）

- 初度登録年月が未入力の場合は、候補が 1 件でも確定せず、適用期間を表示して「確認要」とします。
- 年式の基準は「初度登録」です。

### 13,000 行規模の確認（インメモリ DB）

変換 0.6 秒、取込（検証・申請・承認）各 1〜2 秒、車両検索 0.1〜0.2 秒、登録データ閲覧は 100 件ずつのページ表示。
検索は型式に一致する車両とその要件のみを読み込みます（全件は読みません）。

### 取込テスト用の空 DB

`DATABASE_URL=" " DEMO_EMPTY=1 npm run dev` で、サンプルデータを入れないインメモリ DB で起動します。

## DBJ 様サンプル検証環境

サンプルデータのみを登録した別環境です。Vercel の別プロジェクトで `NEXT_PUBLIC_DATA_PROFILE=dbj-sample` を設定してビルドすると、
入力例が DBJ 様のサンプルに切り替わります。空の DB は `node scripts/setup-db.mjs --empty` で作成できます。

## テストデータ

`public/samples/test/` にどの環境でも使えるテストデータがあります。「CSVマスター管理」の「テストデータ（ワンクリックで読込）」から読み込めます。
①〜⑤を順番に「検証 → 申請 → 別の承認者で承認」すると、`TEST-A100` などの型式で検索できます。

## 自動バックアップ

Vercel Cron が毎日 18:00 UTC（日本時間 3:00）に `/api/cron/backup` を呼び、全マスターと設定を `backups` テーブルへ保存します。保持期間を過ぎたものは自動で削除します。
Vercel の環境変数 `CRON_SECRET` にランダムな文字列を設定してください（未設定の場合は実行されません）。
一覧・手動作成・JSON 取得は「CSVマスター管理 → バックアップ・復元」から行えます。旧版への復元は「承認・更新履歴」から行います。
