-- 架空のサンプルデータ（実在の車両・メーカー・品番とは無関係）
-- 受入試験の各パターン（確認済み・未承認・複数候補・条件不足・未登録・補機・同時搭載・期間境界・年のみ・利用不可出典）を再現する。

INSERT INTO sources (id, name, kind, usage_condition, internal_only, customer_use, note) VALUES
('SRC-DBJ',  'DBJ 確認資料（社内検証済み）',       'DBJ確認',   '顧客回答に利用可',                   false, true,  'DBJ 担当者が現車・取扱説明書で確認'),
('SRC-CAT',  '各社公開カタログ（架空サンプル）',   'カタログ',  '仕様の参照のみ。顧客回答は自社品番に限定', true,  true,  NULL),
('SRC-PTN',  '提携資料X（社内限定）',              '提携資料',  '社内限定・Webサイト表示不可・顧客回答不可', true,  false, 'G&Yu由来資料と同等の扱いを想定'),
('SRC-RAW',  '収集データ（未検証）',               '収集',      '未検証のため回答に利用不可',             true,  false, 'スクレイピング等の一次収集');

INSERT INTO vehicles (id, maker, car_name, model_code, engine_code, grade_spec, conditions, period_basis, period_from, period_to, period_raw, status, source_id, note) VALUES
('V001', 'サンプル自動車', 'サンプルワゴン',     '3BA-AB10',  'K12X', '全グレード',       NULL,            '初度登録', '2019-04', '2023-03', '2019年4月～2023年3月', '適合確認済み', 'SRC-DBJ', NULL),
('V002', 'サンプル自動車', 'サンプルバン',       '5BA-CD20',  'K15X', '標準仕様',         NULL,            '初度登録', '2020-01', NULL,      '2020年1月～',          '適合確認済み', 'SRC-DBJ', NULL),
('V003', 'サンプル自動車', 'サンプルバン',       '5BA-CD20',  'K15X', '寒冷地仕様',       '寒冷地仕様',    '初度登録', '2020-01', NULL,      '2020年1月～',          '適合確認済み', 'SRC-DBJ', NULL),
('V004', 'テスト工業',     'テストセダン',       'DBA-EF30',  'R20T', NULL,               NULL,            '初度登録', '2015-01', '2017-12', '2015年1月～2017年12月', '適合確認済み', 'SRC-DBJ', '前期型'),
('V005', 'テスト工業',     'テストセダン',       'DBA-EF30',  'R20T', 'アイドリングストップ', 'アイドリングストップ', '初度登録', '2018-01', '2020-06', '2018年1月～2020年6月', '適合確認済み', 'SRC-DBJ', '後期型'),
('V006', 'テスト工業',     'テストハイブリッド', '6AA-GH40',  'H18E', 'ハイブリッド',     NULL,            '初度登録', '2021-07', NULL,      '2021年7月～',          '適合確認済み', 'SRC-DBJ', '駆動用電池は対象外。補機バッテリーのみ'),
('V007', 'サンプル自動車', 'サンプルSUV',        '3BA-JK50',  'K20X', NULL,               NULL,            '初度登録', '2022-02', NULL,      '2022年2月～',          '適合確認済み', 'SRC-DBJ', NULL),
('V008', 'テスト工業',     'テストクロス',       '5AA-LM60',  'H20E', NULL,               NULL,            '初度登録', '2021-01', NULL,      '2021年1月～',          '適合確認済み', 'SRC-PTN', '提携資料Xのみで確認'),
('V009', 'サンプル自動車', 'サンプルクーペ',     'DBA-NP70',  'K18X', NULL,               NULL,            '販売',     '2016',    NULL,      '2016年～',             '解析済み',     'SRC-RAW', '期間は販売開始年のみ'),
('V010', 'テスト工業',     'テストトラック',     'QDF-PR80',  'D40T', '4WD',              NULL,            '初度登録', '2017-05', NULL,      '2017年5月～',          '適合確認済み', 'SRC-DBJ', '24V 系。2 個同時搭載（直列）'),
('V011', 'サンプル自動車', 'サンプルミニ',       '5BA-ST90',  'K06X', NULL,               NULL,            '初度登録', '2021-10', NULL,      '2021年10月～',         '収集済み',     'SRC-RAW', '未解析');

INSERT INTO vehicle_batteries (id, vehicle_id, role, category, spec_code, raw_text, qty, condition, status, source_id, note) VALUES
('VB001', 'V001', '主機', 'JIS',     '46B24L', '46B24L',          1, NULL,         '適合確認済み', 'SRC-DBJ', NULL),
('VB002', 'V002', '主機', 'JIS',     '55D23L', '55D23L',          1, NULL,         '適合確認済み', 'SRC-DBJ', NULL),
('VB003', 'V003', '主機', 'JIS',     '80D23L', '80D23L（寒冷地）', 1, '寒冷地仕様', '適合確認済み', 'SRC-DBJ', NULL),
('VB004', 'V004', '主機', 'JIS',     '55B24L', '55B24L',          1, NULL,         '適合確認済み', 'SRC-DBJ', NULL),
('VB005', 'V005', '主機', 'JIS EFB', 'N-55',   'N-55 (ISS)',      1, NULL,         '適合確認済み', 'SRC-DBJ', NULL),
('VB006', 'V006', '補機', 'LN AGM',  'LN1',    'LN1 AGM 補機',     1, NULL,         '適合確認済み', 'SRC-DBJ', NULL),
('VB007', 'V007', '主機', 'LN EFB',  'LN3',    'LN3 EFB',         1, NULL,         '適合確認済み', 'SRC-DBJ', NULL),
('VB008', 'V008', '主機', 'JIS EFB', 'Q-85',   'Q-85',            1, NULL,         '適合確認済み', 'SRC-PTN', NULL),
('VB009', 'V009', '主機', 'JIS',     '55B24L', '55B24L?',         1, NULL,         '解析済み',     'SRC-RAW', NULL),
('VB010', 'V010', '主機', 'JIS',     '80D26L', '80D26L x2',       2, NULL,         '適合確認済み', 'SRC-DBJ', '2 個同時搭載'),
('VB011', 'V011', '主機', 'JIS',     '40B19L', '40B19L',          1, NULL,         '収集済み',     'SRC-RAW', NULL);

INSERT INTO own_products (part_no, name, category, spec_code, size_group, capacity_ah, cca, length_mm, width_mm, height_mm, terminal, application, note) VALUES
('DBJ-40B19L',   'DBJ スタンダード 40B19L', 'JIS',     '40B19L', 'B19', 28,  280, 187, 127, 227, 'L', '充電制御車対応', NULL),
('DBJ-55B24L',   'DBJ スタンダード 55B24L', 'JIS',     '55B24L', 'B24', 36,  370, 238, 129, 227, 'L', '充電制御車対応', NULL),
('DBJ-55D23L',   'DBJ スタンダード 55D23L', 'JIS',     '55D23L', 'D23', 48,  356, 232, 173, 225, 'L', '充電制御車対応', NULL),
('DBJ-80D23L',   'DBJ スタンダード 80D23L', 'JIS',     '80D23L', 'D23', 60,  582, 232, 173, 225, 'L', '充電制御車対応', NULL),
('DBJ-80D26L',   'DBJ スタンダード 80D26L', 'JIS',     '80D26L', 'D26', 65,  582, 260, 173, 225, 'L', '充電制御車対応', NULL),
('DBJ-N55-EFB',  'DBJ アイスト N-55',       'JIS EFB', 'N-55',   'B24', 40,  410, 238, 129, 227, 'L', 'アイドリングストップ車', NULL),
('DBJ-Q85-EFB',  'DBJ アイスト Q-85',       'JIS EFB', 'Q-85',   'D23', 55,  520, 232, 173, 225, 'L', 'アイドリングストップ車', NULL),
('DBJ-LN1-AGM',  'DBJ 欧州規格 LN1 AGM',    'LN AGM',  'LN1',    'LN1', 50,  540, 207, 175, 190, 'R', '補機・ISS', NULL),
('DBJ-LN2',      'DBJ 欧州規格 LN2',        'LN',      'LN2',    'LN2', 60,  540, 242, 175, 190, 'R', '一般車', NULL),
('DBJ-LN3-EFB',  'DBJ 欧州規格 LN3 EFB',    'LN EFB',  'LN3',    'LN3', 70,  720, 278, 175, 190, 'R', 'アイドリングストップ車', NULL);

INSERT INTO products (id, maker, part_no, aliases, category, spec_code, size_group, capacity_ah, cca, length_mm, width_mm, height_mm, terminal, hold_down, application, status, source_id, note) VALUES
('P-A01', 'アルファ電池',       'AL-55B24L',     'AL55B24L|AL-55B24L-N', 'JIS',     '55B24L', 'B24', 36, 370, 238, 129, 227, 'L', '下部固定', '充電制御車対応', '解析済み', 'SRC-CAT', NULL),
('P-B01', 'ベータ電工',         'BT-60B24L/CR',  'BT60B24L',             'JIS',     '60B24L', 'B24', 45, 430, 238, 129, 227, 'L', '下部固定', '充電制御車対応', '解析済み', 'SRC-CAT', '容量ランク違い'),
('P-C01', 'シータ工業',         'TK 55B24L',     'TK-55B24L',            'JIS',     '55B24L', 'B24', 36, 370, 238, 129, 227, 'L', '下部固定', NULL,             '解析済み', 'SRC-CAT', NULL),
('P-D01', 'デルタグローバル',   'DG-55B24L-STD', NULL,                   'JIS',     '55B24L', 'B24', 36, 360, 238, 129, 227, 'L', '下部固定', NULL,             '解析済み', 'SRC-CAT', NULL),
('P-A02', 'アルファ電池',       'AL-80D23L',     NULL,                   'JIS',     '80D23L', 'D23', 60, 582, 232, 173, 225, 'L', '下部固定', '充電制御車対応', '解析済み', 'SRC-CAT', NULL),
('P-B02', 'ベータ電工',         'BT-80D23L/CR',  NULL,                   'JIS',     '80D23L', 'D23', 60, 582, 232, 173, 225, 'L', '下部固定', '充電制御車対応', '解析済み', 'SRC-CAT', NULL),
('P-C02', 'シータ工業',         'TK 80D23L',     NULL,                   'JIS',     '80D23L', 'D23', 60, 570, 232, 173, 225, 'L', '下部固定', NULL,             '解析済み', 'SRC-CAT', NULL),
('P-A03', 'アルファ電池',       'AL-N55',        'AL-N-55|ALN55',        'JIS EFB', 'N-55',   'B24', 40, 410, 238, 129, 227, 'L', '下部固定', 'アイドリングストップ車', '解析済み', 'SRC-CAT', NULL),
('P-B03', 'ベータ電工',         'BT-N-55/ISS',   NULL,                   'JIS EFB', 'N-55',   'B24', 40, 410, 238, 129, 227, 'L', '下部固定', 'アイドリングストップ車', '解析済み', 'SRC-CAT', NULL),
('P-D03', 'デルタグローバル',   'DG-N55-EFB',    NULL,                   'JIS EFB', 'N-55',   'B24', 40, 400, 238, 129, 227, 'L', '下部固定', 'アイドリングストップ車', '収集済み', 'SRC-RAW', '仕様未検証'),
('P-A04', 'アルファ電池',       'AL-Q85',        NULL,                   'JIS EFB', 'Q-85',   'D23', 55, 520, 232, 173, 225, 'L', '下部固定', 'アイドリングストップ車', '解析済み', 'SRC-CAT', NULL),
('P-C04', 'シータ工業',         'TK Q-85',       NULL,                   'JIS EFB', 'Q-85',   'D23', 55, 520, 232, 173, 225, 'L', '下部固定', 'アイドリングストップ車', '解析済み', 'SRC-CAT', NULL),
('P-A05', 'アルファ電池',       'AL-LN2',        'AL-LN2-STD',           'LN',      'LN2',    'LN2', 60, 540, 242, 175, 190, 'R', '下部固定（欧州）', '一般車', '解析済み', 'SRC-CAT', NULL),
('P-B05', 'ベータ電工',         'BT-LN2-EFB',    NULL,                   'LN EFB',  'LN2',    'LN2', 60, 560, 242, 175, 190, 'R', '下部固定（欧州）', 'アイドリングストップ車', '解析済み', 'SRC-CAT', 'DBJ に LN2 EFB の取扱なし'),
('P-C05', 'シータ工業',         'TK LN2 AGM',    NULL,                   'LN AGM',  'LN2',    'LN2', 60, 680, 242, 175, 190, 'R', '下部固定（欧州）', 'ISS・回生', '解析済み', 'SRC-CAT', NULL),
('P-A06', 'アルファ電池',       'AL-LN1-AGM',    NULL,                   'LN AGM',  'LN1',    'LN1', 50, 540, 207, 175, 190, 'R', '下部固定（欧州）', '補機', '解析済み', 'SRC-CAT', NULL),
('P-D06', 'デルタグローバル',   'DG-LN1-AGM',    NULL,                   'LN AGM',  'LN1',    'LN1', 50, 520, 207, 175, 190, 'R', '下部固定（欧州）', '補機', '解析済み', 'SRC-CAT', NULL),
('P-B07', 'ベータ電工',         'BT-LN3-EFB',    NULL,                   'LN EFB',  'LN3',    'LN3', 70, 720, 278, 175, 190, 'R', '下部固定（欧州）', 'アイドリングストップ車', '解析済み', 'SRC-CAT', NULL),
('P-C07', 'シータ工業',         'TK LN3 EFB',    NULL,                   'LN EFB',  'LN3',    'LN3', 70, 700, 278, 175, 190, 'R', '下部固定（欧州）', 'アイドリングストップ車', '解析済み', 'SRC-PTN', '提携資料Xより');

INSERT INTO own_mappings (id, match_type, category, spec_code, product_id, own_part_no, direction, status, customer_use, conditions, source_id, approved_by, approved_at, note) VALUES
-- 車両要件（規格）→ 自社品番
('M001', 'spec', 'JIS',     '46B24L', NULL, 'DBJ-55B24L',  '置換元→自社', '自社対応確認済み', true,  '同寸法・上位容量', 'SRC-DBJ', '中野', '2026-09-10', '46B24L 搭載車へ 55B24L を推奨'),
('M002', 'spec', 'JIS',     '55B24L', NULL, 'DBJ-55B24L',  '双方向',     '自社対応確認済み', true,  NULL,               'SRC-DBJ', '中野', '2026-09-10', NULL),
('M003', 'spec', 'JIS',     '55D23L', NULL, 'DBJ-55D23L',  '双方向',     '自社対応確認済み', true,  NULL,               'SRC-DBJ', '中野', '2026-09-10', NULL),
('M004', 'spec', 'JIS',     '80D23L', NULL, 'DBJ-80D23L',  '双方向',     '自社対応確認済み', true,  NULL,               'SRC-DBJ', '中野', '2026-09-10', NULL),
('M005', 'spec', 'JIS EFB', 'N-55',   NULL, 'DBJ-N55-EFB', '双方向',     '自社対応確認済み', true,  'アイドリングストップ車', 'SRC-DBJ', '中野', '2026-09-12', NULL),
('M006', 'spec', 'LN AGM',  'LN1',    NULL, 'DBJ-LN1-AGM', '双方向',     '自社対応確認済み', true,  '補機用途',         'SRC-DBJ', '中野', '2026-09-12', NULL),
('M007', 'spec', 'LN EFB',  'LN3',    NULL, 'DBJ-LN3-EFB', '双方向',     '未確認',           false, NULL,               'SRC-RAW', NULL,   NULL,         '端子形状の確認待ち'),
('M008', 'spec', 'JIS EFB', 'Q-85',   NULL, 'DBJ-Q85-EFB', '双方向',     '自社対応確認済み', false, NULL,               'SRC-PTN', '中野', '2026-09-15', '提携資料Xに基づく。顧客回答不可'),
('M009', 'spec', 'JIS',     '80D26L', NULL, 'DBJ-80D26L',  '双方向',     '自社対応確認済み', true,  NULL,               'SRC-DBJ', '中野', '2026-09-10', NULL),
('M010', 'spec', 'JIS',     '40B19L', NULL, 'DBJ-40B19L',  '双方向',     '自社対応確認済み', true,  NULL,               'SRC-DBJ', '中野', '2026-09-10', NULL),
('M011', 'spec', 'LN',      'LN2',    NULL, 'DBJ-LN2',     '双方向',     '自社対応確認済み', true,  NULL,               'SRC-DBJ', '中野', '2026-09-10', NULL),
-- 他社商品 → 自社品番（現物品番からの商品置換）
('M101', 'product', NULL, NULL, 'P-A01', 'DBJ-55B24L',  '置換元→自社', '自社対応確認済み', true,  NULL, 'SRC-DBJ', '中野', '2026-09-20', NULL),
('M102', 'product', NULL, NULL, 'P-C01', 'DBJ-55B24L',  '置換元→自社', '自社対応確認済み', true,  NULL, 'SRC-DBJ', '中野', '2026-09-20', NULL),
('M103', 'product', NULL, NULL, 'P-D01', 'DBJ-55B24L',  '置換元→自社', '未確認',           false, NULL, 'SRC-RAW', NULL,   NULL,         'CCA 差の確認待ち'),
('M104', 'product', NULL, NULL, 'P-A02', 'DBJ-80D23L',  '置換元→自社', '自社対応確認済み', true,  NULL, 'SRC-DBJ', '中野', '2026-09-20', NULL),
('M105', 'product', NULL, NULL, 'P-B02', 'DBJ-80D23L',  '置換元→自社', '自社対応確認済み', true,  NULL, 'SRC-DBJ', '中野', '2026-09-20', NULL),
('M106', 'product', NULL, NULL, 'P-A03', 'DBJ-N55-EFB', '置換元→自社', '自社対応確認済み', true,  NULL, 'SRC-DBJ', '中野', '2026-09-20', NULL),
('M107', 'product', NULL, NULL, 'P-B03', 'DBJ-N55-EFB', '置換元→自社', '自社対応確認済み', true,  NULL, 'SRC-DBJ', '中野', '2026-09-20', NULL),
('M108', 'product', NULL, NULL, 'P-A05', 'DBJ-LN2',     '置換元→自社', '自社対応確認済み', true,  NULL, 'SRC-DBJ', '中野', '2026-09-20', NULL),
('M109', 'product', NULL, NULL, 'P-A06', 'DBJ-LN1-AGM', '置換元→自社', '自社対応確認済み', true,  NULL, 'SRC-DBJ', '中野', '2026-09-20', NULL),
('M110', 'product', NULL, NULL, 'P-A04', 'DBJ-Q85-EFB', '置換元→自社', '自社対応確認済み', false, NULL, 'SRC-PTN', '中野', '2026-09-20', '顧客回答不可（出典条件）');

INSERT INTO app_settings (key, value) VALUES
('auto_reply_enabled', 'true'::jsonb),
('ocr_retention', '{"success_minutes":0,"failure_minutes":0,"note":"抽出後ただちに破棄。ログ・バックアップへ画像・全文を書き込まない"}'::jsonb);

-- 初版（v1）のスナップショット
INSERT INTO master_versions (dataset, version_no, status, mode, summary, snapshot, submitted_by, reviewed_by, reviewed_at, review_note)
SELECT d.dataset, 1, 'published', 'initial', jsonb_build_object('added', d.cnt, 'changed', 0, 'deleted', 0, 'total', d.cnt), d.snap, 'システム', 'システム', now(), '初期登録'
FROM (
  SELECT 'sources' AS dataset, count(*) AS cnt, coalesce(jsonb_agg(to_jsonb(t) ORDER BY id), '[]') AS snap FROM sources t
  UNION ALL SELECT 'vehicles', count(*), coalesce(jsonb_agg(to_jsonb(t) ORDER BY id), '[]') FROM vehicles t
  UNION ALL SELECT 'vehicle_batteries', count(*), coalesce(jsonb_agg(to_jsonb(t) ORDER BY id), '[]') FROM vehicle_batteries t
  UNION ALL SELECT 'products', count(*), coalesce(jsonb_agg(to_jsonb(t) ORDER BY id), '[]') FROM products t
  UNION ALL SELECT 'own_products', count(*), coalesce(jsonb_agg(to_jsonb(t) ORDER BY part_no), '[]') FROM own_products t
  UNION ALL SELECT 'own_mappings', count(*), coalesce(jsonb_agg(to_jsonb(t) ORDER BY id), '[]') FROM own_mappings t
) d;
