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

## 既存形式 CSV の変換（データ移行）

1 行 = 1 車両適合の横長 CSV を、定型 CSV 5 種（sources / own_products / vehicles / vehicle_batteries / own_mappings）に変換します。

```bash
npm run data:convert -- <入力CSV> <出力フォルダ> [--basis 初度登録]
```

`report.md` にエラーと要確認事項を出力します。エラーがある場合は取込用 CSV を出力しません。
変換後の CSV は、上記の順に「CSVマスター管理」から取り込み、承認します。

## DBJ 様サンプル検証環境

サンプルデータのみを登録した別環境です。Vercel の別プロジェクトで `NEXT_PUBLIC_DATA_PROFILE=dbj-sample` を設定してビルドすると、
入力例が DBJ 様のサンプルに切り替わります。空の DB は `node scripts/setup-db.mjs --empty` で作成できます。

## テストデータ

`public/samples/test/` にどの環境でも使えるテストデータがあります。「CSVマスター管理」の「テストデータ（ワンクリックで読込）」から読み込めます。
①〜⑤を順番に「検証 → 申請 → 別の承認者で承認」すると、`TEST-A100` などの型式で検索できます。
