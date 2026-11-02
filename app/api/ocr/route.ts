import { ok } from "@/lib/api";

// オプション B（車検証 OCR）のデモ。実運用では画像解析 API（例: Google Cloud Vision / Azure Document Intelligence 等、
// 学習利用なし・国内リージョンを選定）に画像を送り、技術項目だけを抽出する。
// 画像・OCR 全文は保存せず、レスポンス返却後に破棄する（ログにも書かない）。

type Field = { key: string; label: string; value: string; confidence: number; matchable: boolean; note?: string };

const SAMPLES: Record<string, Field[]> = {
  clear: [
    { key: "modelCode", label: "型式", value: "DBA-EF30", confidence: 0.98, matchable: true },
    { key: "engineCode", label: "原動機の型式", value: "R20T", confidence: 0.96, matchable: true },
    { key: "regYm", label: "初度登録年月", value: "2019-05", confidence: 0.93, matchable: true, note: "原文「令和元年5月」を西暦に変換" },
    { key: "chassis", label: "車台番号", value: "EF30-******", confidence: 0.9, matchable: false, note: "照合に使わないためマスキング・非保存" },
  ],
  blurry: [
    { key: "modelCode", label: "型式", value: "5BA-CD2O", confidence: 0.54, matchable: true, note: "末尾が「0」か「O」か判別不能" },
    { key: "engineCode", label: "原動機の型式", value: "K15X", confidence: 0.88, matchable: true },
    { key: "regYm", label: "初度登録年月", value: "", confidence: 0, matchable: true, note: "読取不能（推測しない）" },
    { key: "chassis", label: "車台番号", value: "******", confidence: 0.4, matchable: false, note: "照合に使わないためマスキング・非保存" },
  ],
};

export async function POST(req: Request) {
  const form = await req.formData();
  const sample = String(form.get("sample") ?? "");
  const file = form.get("image");
  const log: string[] = [];
  let fields = SAMPLES[sample];
  if (file instanceof File && file.size > 0) {
    log.push(`画像を受信（${Math.round(file.size / 1024)} KB）。メモリ上でのみ処理`);
    log.push("デモ環境では外部 OCR API に接続していないため、サンプル抽出結果を返します");
    fields = SAMPLES.clear;
  }
  if (!fields) fields = SAMPLES.clear;
  log.push("技術項目のみ抽出（氏名・住所・使用者情報は取得しない）");
  log.push("画像・OCR 全文を破棄（保存期間 0 分。ログ・バックアップに含めない）");
  const lowConfidence = fields.filter((f) => f.matchable && f.confidence < 0.8).map((f) => f.label);
  return ok({ fields, lowConfidence, log, autoAnswerBlocked: lowConfidence.length > 0 });
}
