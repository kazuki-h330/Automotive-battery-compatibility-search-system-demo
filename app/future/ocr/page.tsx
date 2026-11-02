"use client";

import { useState } from "react";
import { ImageUp, ScanText, Search } from "lucide-react";
import { actorPayload, postJson, useActor } from "@/components/actor";
import { AlertMessage } from "@/components/alert-message";
import { FutureHeader } from "@/components/future-banner";
import { SectionTitle } from "@/components/page-header";
import { ResultCard } from "@/components/result-card";
import { Badge } from "@/components/status-badge";
import type { JudgeResult } from "@/lib/judge";

type Field = { key: string; label: string; value: string; confidence: number; matchable: boolean; note?: string };

export default function OcrPreview() {
  const { actor } = useActor();
  const [fields, setFields] = useState<Field[] | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<JudgeResult | null>(null);

  async function extract(sample?: string, file?: File) {
    setBusy(true);
    setRes(null);
    const fd = new FormData();
    if (sample) fd.set("sample", sample);
    if (file) fd.set("image", file);
    const r = await (await fetch("/api/ocr", { method: "POST", body: fd })).json();
    setBusy(false);
    setFields(r.fields);
    setLog(r.log);
    setChecked({});
  }

  const low = (f: Field) => f.matchable && f.confidence < 0.8;
  const unresolved = fields?.filter((f) => low(f) && !checked[f.key]) ?? [];

  async function search() {
    const get = (k: string) => fields?.find((f) => f.key === k)?.value || undefined;
    const r = await postJson("/api/search/vehicle", {
      query: { modelCode: get("modelCode") ?? "", engineCode: get("engineCode"), regYm: get("regYm") },
      actor: actorPayload(actor),
      channel: "ocr-demo",
    });
    if (r.status === 200) setRes(r.data.result);
  }

  return (
    <>
      <FutureHeader
        title="車検証OCR受付"
        option="拡張 B"
        description="車検証の画像から型式・原動機型式・初度登録年月だけを読み取り、利用者が確認・訂正してから判定に使います。読み取りが不確かな場合は推測せず、自動回答を止めます。"
        reuse="読み取り結果を Phase 1 の共通判定処理へ渡すだけで、判定を作り直しません。"
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <section className="card flex flex-wrap items-center gap-2 px-5 py-4">
            <button className="btn-secondary" onClick={() => extract("clear")} disabled={busy}>
              <ScanText size={16} aria-hidden /> サンプル（鮮明な画像）
            </button>
            <button className="btn-secondary" onClick={() => extract("blurry")} disabled={busy}>
              <ScanText size={16} aria-hidden /> サンプル（不鮮明な画像）
            </button>
            <label className="btn-secondary cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-action">
              <ImageUp size={16} aria-hidden /> 画像を選択
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && extract(undefined, e.target.files[0])} />
            </label>
            <span className="text-xs text-muted">プレビューでは外部の読み取りサービスに接続せず、サンプル結果を表示します</span>
          </section>

          {fields && (
            <section className="card overflow-hidden">
              <SectionTitle>読み取り結果の確認・訂正</SectionTitle>
              <div className="overflow-x-auto">
                <table className="dt">
                  <thead>
                    <tr>
                      <th>項目</th>
                      <th>読み取り値（訂正できます）</th>
                      <th>確からしさ</th>
                      <th>判定に使用</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((f, i) => (
                      <tr key={f.key} className={low(f) && !checked[f.key] ? "[&>td]:bg-warn-soft!" : ""}>
                        <td className="font-medium whitespace-nowrap">{f.label}</td>
                        <td className="min-w-56">
                          {f.matchable ? (
                            <input
                              className="field font-mono"
                              value={f.value}
                              aria-label={f.label}
                              placeholder={f.key === "regYm" ? "YYYY-MM" : ""}
                              onChange={(e) => {
                                const next = [...fields];
                                next[i] = { ...f, value: e.target.value };
                                setFields(next);
                                setChecked({ ...checked, [f.key]: true });
                              }}
                            />
                          ) : (
                            <span className="font-mono text-muted">{f.value}</span>
                          )}
                          {f.note && <div className="mt-1 text-xs text-muted">{f.note}</div>}
                          {low(f) && (
                            <label className="mt-1 flex items-center gap-1.5 text-xs font-medium text-warn-ink">
                              <input type="checkbox" className="h-3.5 w-3.5 accent-action" checked={!!checked[f.key]} onChange={(e) => setChecked({ ...checked, [f.key]: e.target.checked })} />
                              車検証を見て確認・訂正しました
                            </label>
                          )}
                        </td>
                        <td className="w-32">
                          <div className="h-1.5 rounded-full bg-line-soft">
                            <div className={`h-1.5 rounded-full ${f.confidence >= 0.8 ? "bg-ok" : "bg-warn"}`} style={{ width: `${f.confidence * 100}%` }} />
                          </div>
                          <div className="mt-0.5 text-xs text-muted tnum">{Math.round(f.confidence * 100)}%</div>
                        </td>
                        <td>{f.matchable ? <Badge tone="navy">使用する</Badge> : <Badge>使用しない</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3.5">
                <button className="btn-primary" onClick={search} disabled={unresolved.length > 0}>
                  <Search size={16} aria-hidden /> この内容で適合を検索
                </button>
                {unresolved.length > 0 && (
                  <span className="text-[13px] text-warn-ink">「{unresolved.map((f) => f.label).join("・")}」を確認してください。LINE 経由の場合は自動回答せずスタッフへ引き継ぎます。</span>
                )}
              </div>
            </section>
          )}
          {res && <ResultCard r={res} kindLabel="車両適合（OCR 入力）" />}
        </div>

        <div className="space-y-4">
          {log.length > 0 && (
            <AlertMessage variant="info" title="処理内容">
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {log.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </AlertMessage>
          )}
          <section className="card">
            <SectionTitle>対応する書類</SectionTitle>
            <ul className="space-y-2 px-5 py-4 text-[13px]">
              <li className="flex items-start gap-2">
                <Badge tone="success">対応</Badge> 旧車検証（A4 用紙）
              </li>
              <li className="flex items-start gap-2">
                <Badge tone="warning">券面のみ</Badge> 電子車検証（IC タグ内の情報は写真から読み取れません）
              </li>
              <li className="flex items-start gap-2">
                <Badge tone="success">対応</Badge> 自動車検査証記録事項
              </li>
            </ul>
          </section>
          <section className="card">
            <SectionTitle>個人情報の取り扱い</SectionTitle>
            <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-xs text-ink/80">
              <li>読み取るのは技術項目のみ。氏名・住所は取得しません</li>
              <li>画像・読み取り全文は処理後ただちに破棄（保存しません）</li>
              <li>ログやバックアップに画像・全文を含めません</li>
              <li>外部サービスは学習利用なし・国内処理の条件で選定します</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
