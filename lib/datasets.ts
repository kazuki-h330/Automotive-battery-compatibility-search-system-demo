// 定型 CSV の仕様。CSV ヘッダー＝列名（英字）。取込検証・差分・エクスポート・画面表示で共通利用する。

// DIN / EN は欧州規格の表記（例: DIN 56219、EN H5）。規格表記は原表記を正規化して保持し、LN への読み替えはしない
export const CATEGORIES = ["JIS", "JIS EFB", "LN", "LN EFB", "LN AGM", "DIN", "DIN EFB", "DIN AGM", "EN", "EN EFB", "EN AGM"] as const;
export const VEHICLE_STATUS = ["収集済み", "解析済み", "適合確認済み"] as const;
export const PRODUCT_STATUS = ["収集済み", "解析済み"] as const;
export const MAPPING_STATUS = ["未確認", "自社対応確認済み"] as const;
export const PERIOD_BASIS = ["初度登録", "販売", "製造", "不明"] as const;
export const CASE_STATUS = ["実車確認済み", "未確認"] as const;

export type ColType = "text" | "int" | "num" | "bool" | "ym";
export type Column = {
  name: string;
  label: string;
  type?: ColType;
  required?: boolean;
  enum?: readonly string[];
  ref?: DatasetId;
};

export type DatasetId =
  | "sources"
  | "vehicles"
  | "vehicle_batteries"
  | "products"
  | "own_products"
  | "own_mappings"
  | "vehicle_cases";

export type Dataset = {
  id: DatasetId;
  label: string;
  description: string;
  key: string;
  columns: Column[];
};

export const DATASETS: Dataset[] = [
  {
    id: "sources",
    label: "出典・利用条件",
    description: "資料ごとの利用条件と顧客回答への利用可否",
    key: "id",
    columns: [
      { name: "id", label: "出典ID", required: true },
      { name: "name", label: "名称", required: true },
      { name: "kind", label: "種別", required: true },
      { name: "usage_condition", label: "利用条件" },
      { name: "internal_only", label: "社内限定", type: "bool", required: true },
      { name: "customer_use", label: "顧客回答利用可", type: "bool", required: true },
      { name: "note", label: "備考" },
    ],
  },
  {
    id: "vehicles",
    label: "車両条件",
    description: "型式・原動機・期間・仕様条件（型式は原表記のまま保持）",
    key: "id",
    columns: [
      { name: "id", label: "車両ID", required: true },
      { name: "maker", label: "メーカー", required: true },
      { name: "car_name", label: "車名", required: true },
      { name: "model_code", label: "型式", required: true },
      { name: "engine_code", label: "原動機型式" },
      { name: "type_specification_no", label: "型式指定番号" },
      { name: "classification_no", label: "類別区分番号" },
      { name: "grade_spec", label: "グレード・仕様" },
      { name: "conditions", label: "装備条件" },
      { name: "period_basis", label: "期間の基準", required: true, enum: PERIOD_BASIS },
      { name: "period_from", label: "期間開始", type: "ym" },
      { name: "period_to", label: "期間終了", type: "ym" },
      { name: "period_raw", label: "期間（原文）" },
      { name: "status", label: "確認状態", required: true, enum: VEHICLE_STATUS },
      { name: "source_id", label: "出典", required: true, ref: "sources" },
      { name: "note", label: "備考" },
    ],
  },
  {
    id: "vehicle_batteries",
    label: "搭載バッテリー要件",
    description: "車両ごとの主機・補機・同時搭載・条件付き要件",
    key: "id",
    columns: [
      { name: "id", label: "要件ID", required: true },
      { name: "vehicle_id", label: "車両ID", required: true, ref: "vehicles" },
      // 未確定 = 元データに主機・補機の記載がない（推測で主機としない）。判定では確定しない
      { name: "role", label: "用途", required: true, enum: ["主機", "補機", "未確定"] },
      { name: "category", label: "規格区分", required: true, enum: CATEGORIES },
      { name: "spec_code", label: "規格表記", required: true },
      { name: "raw_text", label: "原文" },
      { name: "qty", label: "個数", type: "int", required: true },
      { name: "condition", label: "条件" },
      { name: "status", label: "確認状態", required: true, enum: VEHICLE_STATUS },
      { name: "source_id", label: "出典", required: true, ref: "sources" },
      { name: "note", label: "備考" },
    ],
  },
  {
    id: "products",
    label: "各社商品・仕様",
    description: "主要メーカー品番と仕様（規格表記と商品コードは分離）",
    key: "id",
    columns: [
      { name: "id", label: "商品ID", required: true },
      { name: "maker", label: "メーカー", required: true },
      { name: "part_no", label: "品番（原表記）", required: true },
      { name: "aliases", label: "旧品番・別名" },
      { name: "category", label: "規格区分", required: true, enum: CATEGORIES },
      { name: "spec_code", label: "規格表記", required: true },
      { name: "size_group", label: "サイズ", required: true },
      { name: "capacity_ah", label: "容量(Ah)", type: "num" },
      { name: "cca", label: "CCA", type: "int" },
      { name: "length_mm", label: "長さ", type: "int" },
      { name: "width_mm", label: "幅", type: "int" },
      { name: "height_mm", label: "高さ", type: "int" },
      { name: "terminal", label: "端子", enum: ["L", "R"] },
      { name: "hold_down", label: "固定方法" },
      { name: "application", label: "用途" },
      { name: "status", label: "確認状態", required: true, enum: PRODUCT_STATUS },
      { name: "source_id", label: "出典", required: true, ref: "sources" },
      { name: "note", label: "備考" },
    ],
  },
  {
    id: "own_products",
    label: "自社商品",
    description: "DBJ 取扱品番と仕様",
    key: "part_no",
    columns: [
      { name: "part_no", label: "自社品番", required: true },
      { name: "name", label: "商品名", required: true },
      { name: "category", label: "規格区分", required: true, enum: CATEGORIES },
      { name: "spec_code", label: "規格表記", required: true },
      { name: "size_group", label: "サイズ", required: true },
      { name: "capacity_ah", label: "容量(Ah)", type: "num" },
      { name: "cca", label: "CCA", type: "int" },
      { name: "length_mm", label: "長さ", type: "int" },
      { name: "width_mm", label: "幅", type: "int" },
      { name: "height_mm", label: "高さ", type: "int" },
      { name: "terminal", label: "端子", enum: ["L", "R"] },
      { name: "application", label: "用途" },
      { name: "note", label: "備考" },
    ],
  },
  {
    id: "own_mappings",
    label: "自社商品対応",
    description: "規格・他社商品 → 自社品番の対応（DBJ 承認分のみ回答に使用）",
    key: "id",
    columns: [
      { name: "id", label: "対応ID", required: true },
      { name: "match_type", label: "対応元", required: true, enum: ["spec", "product"] },
      { name: "category", label: "規格区分", enum: CATEGORIES },
      { name: "spec_code", label: "規格表記" },
      { name: "product_id", label: "他社商品ID", ref: "products" },
      { name: "own_part_no", label: "自社品番", required: true, ref: "own_products" },
      { name: "direction", label: "置換方向", required: true, enum: ["双方向", "置換元→自社"] },
      { name: "status", label: "確認状態", required: true, enum: MAPPING_STATUS },
      { name: "customer_use", label: "顧客回答利用可", type: "bool", required: true },
      { name: "conditions", label: "条件" },
      { name: "source_id", label: "出典", required: true, ref: "sources" },
      { name: "approved_by", label: "承認者" },
      { name: "approved_at", label: "承認日" },
      { name: "note", label: "備考" },
    ],
  },
  {
    id: "vehicle_cases",
    label: "実車確認記録",
    description: "実車 1 台に限る確認記録（管理ID 単位）。型式検索では参考表示のみで、自動回答には使わない",
    key: "id",
    columns: [
      { name: "id", label: "記録ID", required: true },
      { name: "case_id", label: "管理ID", required: true },
      { name: "maker", label: "メーカー", required: true },
      { name: "car_name", label: "車名" },
      { name: "model_code", label: "型式", required: true },
      { name: "engine_code", label: "原動機型式" },
      { name: "type_specification_no", label: "型式指定番号" },
      { name: "classification_no", label: "類別区分番号" },
      { name: "role", label: "用途", enum: ["主機", "補機"] },
      { name: "qty", label: "個数", type: "int" },
      { name: "category", label: "規格区分", enum: CATEGORIES },
      { name: "spec_code", label: "規格表記" },
      { name: "own_part_no", label: "確認した品番", required: true },
      { name: "status", label: "確認状態", required: true, enum: CASE_STATUS },
      { name: "customer_use", label: "この車両への回答可", type: "bool", required: true },
      { name: "scope_note", label: "仕様・範囲" },
      { name: "source_note", label: "出典・根拠" },
      { name: "approved_by", label: "承認者" },
      { name: "approved_at", label: "承認日" },
    ],
  },
];

export function getDataset(id: string): Dataset | undefined {
  return DATASETS.find((d) => d.id === id);
}

/** 参照されている側（例：vehicles は vehicle_batteries から参照される） */
export function referencedBy(id: DatasetId) {
  return DATASETS.flatMap((d) =>
    d.columns.filter((c) => c.ref === id).map((c) => ({ dataset: d.id, column: c.name })),
  );
}
