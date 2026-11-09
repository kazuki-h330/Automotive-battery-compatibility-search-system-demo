"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Download, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";
import { actorPayload, postJson, useActor } from "./actor";
import { AlertMessage } from "./alert-message";
import { ConfirmDialog } from "./confirm-dialog";
import { DiffCounts, DiffPreview } from "./diff-preview";
import { Badge } from "./status-badge";
import { DATASETS, getDataset } from "@/lib/datasets";
import { MODE_LABEL, detectDatasetFromText, type ValidationResult } from "@/lib/csv";
import { DBJ_SAMPLE } from "@/lib/profile";
import { FLAT_ORDER, convertFlat, isFlatCsv, type FlatResult } from "@/lib/flat";

const STEPS = ["CSVアップロード", "形式検証", "差分確認", "承認", "本番反映"];

const SAMPLES = [
  { file: "own_mappings_approve_ln3.csv", dataset: "own_mappings", mode: "upsert", label: "LN3 EFB の自社対応を承認済みに更新", ok: true },
  { file: "vehicles_add_ok.csv", dataset: "vehicles", mode: "upsert", label: "車両 1 件追加・1 件変更", ok: true },
  { file: "vehicles_errors.csv", dataset: "vehicles", mode: "upsert", label: "形式・必須・参照エラーを含む", ok: false },
  { file: "vehicles_delete_referenced.csv", dataset: "vehicles", mode: "delete", label: "参照中の車両を削除指定", ok: false },
  { file: "vehicle_batteries_add.csv", dataset: "vehicle_batteries", mode: "upsert", label: "搭載要件の追加（参照先が必要）", ok: false },
];

// どの環境でも使えるテストデータ（public/samples/test）。上から順に取り込む
const TEST_FILES = [
  // DBJ 様サンプル検証環境には仮品番を混ぜない（要件 6.3）
  ...(DBJ_SAMPLE
    ? [
        { file: "test/S1_id7_unapprove.csv", dataset: "own_mappings", mode: "upsert", label: "ID 7 の承認を取り消す（差分・承認・復元の確認用）", ok: true },
        { file: "test/S2_delete_referenced.csv", dataset: "vehicles", mode: "delete", label: "エラー: 参照中の車両（ID 1）を削除", ok: false },
      ]
    : [
  { file: "test/00_sources_add.csv", dataset: "sources", mode: "upsert", label: "① 出典を追加", ok: true },
  { file: "test/01_own_products_add.csv", dataset: "own_products", mode: "upsert", label: "② 自社商品を追加", ok: true },
  { file: "test/02_vehicles_add.csv", dataset: "vehicles", mode: "upsert", label: "③ 車両を追加", ok: true },
  { file: "test/03_vehicle_batteries_add.csv", dataset: "vehicle_batteries", mode: "upsert", label: "④ 搭載要件を追加", ok: true },
  { file: "test/04_own_mappings_add.csv", dataset: "own_mappings", mode: "upsert", label: "⑤ 自社対応を追加", ok: true },
  { file: "test/05_own_mappings_change_to_unapproved.csv", dataset: "own_mappings", mode: "upsert", label: "⑥ 承認を取り消す（復元の確認用）", ok: true },
  { file: "test/E4_vehicles_delete_referenced.csv", dataset: "vehicles", mode: "delete", label: "エラー: 参照中の車両を削除", ok: false },
      ]),
  { file: "test/E1_vehicles_errors.csv", dataset: "vehicles", mode: "upsert", label: "エラー: 車両（形式・参照）", ok: false },
  { file: "test/E2_vehicle_batteries_errors.csv", dataset: "vehicle_batteries", mode: "upsert", label: "エラー: 搭載要件（個数・区分）", ok: false },
  { file: "test/E3_own_mappings_no_approver.csv", dataset: "own_mappings", mode: "upsert", label: "エラー: 承認者なしの承認済み", ok: false },
  { file: "test/E5_wrong_header.csv", dataset: "vehicles", mode: "upsert", label: "エラー: 定型外の列", ok: false },
];

type Mode = "upsert" | "replace" | "delete";
type Pending = { id: number; version_no: number; submitted_by: string };

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="更新の手順">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={s} className="flex shrink-0 items-center gap-1" aria-current={active ? "step" : undefined}>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold tnum ${
                done ? "bg-charcoal text-white" : active ? "bg-brand text-white ring-4 ring-brand/15" : "bg-line-soft text-muted"
              }`}
            >
              {done ? <Check size={13} aria-hidden /> : n}
            </span>
            <span className={`text-[13px] ${active ? "font-bold text-ink" : done ? "text-charcoal" : "text-muted"}`}>{s}</span>
            {n < STEPS.length && <span className={`mx-2 h-px w-6 md:w-10 ${done ? "bg-charcoal" : "bg-line"}`} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

export function CSVUploadPanel() {
  const { actor } = useActor();
  const [dataset, setDataset] = useState("vehicles");
  const [mode, setMode] = useState<Mode>("upsert");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [allowDelete, setAllowDelete] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [published, setPublished] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [flat, setFlat] = useState<{ name: string; result: FlatResult; done: string[] } | null>(null);

  const ds = getDataset(dataset)!;
  const step = published ? 5 : pending ? 4 : result?.ok ? 3 : csv ? 2 : 1;

  function reset(keepDataset = true) {
    setCsv("");
    setFileName("");
    setResult(null);
    setPending(null);
    setPublished(null);
    setAllowDelete(false);
    setError("");
    setNotice("");
    if (!keepDataset) setDataset("vehicles");
  }

  async function loadFile(f: File) {
    const buf = await f.arrayBuffer();
    // UTF-8 を基本とし、読めない場合は Excel 保存の Shift_JIS として読む
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("shift_jis").decode(buf);
    reset();
    // DBJ 既存形式の CSV は定型 CSV 5 種に変換し、順番に取り込めるようにする
    if (isFlatCsv(text)) {
      setFlat({ name: f.name, result: convertFlat(text), done: [] });
      return;
    }
    setFlat(null);
    // ファイルの列から対象マスターを自動で選ぶ（選択ミスの防止）
    const found = detectDatasetFromText(text);
    if (found && found.id !== dataset) {
      setDataset(found.id);
      setNotice(`ファイルの列から、対象マスターを「${found.label}」に切り替えました`);
    }
    setCsv(text);
    setFileName(f.name);
  }

  async function loadSample(s: { file: string; dataset: string; mode: string }) {
    const res = await fetch(`/samples/${s.file}`);
    if (!res.ok) return setError(`サンプルを読み込めませんでした（${s.file}）`);
    const text = await res.text();
    reset();
    setDataset(s.dataset);
    setMode(s.mode as Mode);
    setCsv(text);
    setFileName(s.file);
  }

  function loadFlatStep(id: (typeof FLAT_ORDER)[number]) {
    if (!flat) return;
    reset();
    setDataset(id);
    setMode("upsert");
    setCsv(flat.result.csv[id]!);
    setFileName(`${flat.name.replace(/\.csv$/i, "")}_${id}.csv`);
  }

  // 1 回の送信上限（約 4.5MB）を超えないよう、大きいファイルは分割を案内する
  const MAX_BYTES = 4_000_000;
  const tooLarge = () => {
    const bytes = new Blob([csv]).size;
    if (bytes <= MAX_BYTES) return false;
    setError(`ファイルが大きすぎます（${(bytes / 1_000_000).toFixed(1)}MB）。1 ファイル約 4MB まで（目安: 車両データで約 2 万行）です。メーカー別などに分けて取り込んでください`);
    return true;
  };

  async function validate() {
    if (tooLarge()) return;
    setBusy(true);
    setError("");
    const r = await postJson("/api/master/validate", { dataset, mode, csv });
    setBusy(false);
    if (r.status !== 200) return setError(r.data.error);
    setResult(r.data);
  }

  async function submit() {
    if (tooLarge()) return;
    setBusy(true);
    setError("");
    const r = await postJson("/api/master/submit", { dataset, mode, csv, fileName, actor: actorPayload(actor), allowDelete });
    setBusy(false);
    if (r.status === 200) setPending({ id: r.data.version.id, version_no: r.data.version.version_no, submitted_by: actor.name });
    else if (r.status === 422) setResult(r.data.validation);
    else setError(r.data.error);
  }

  async function approve() {
    if (!pending) return;
    setBusy(true);
    setError("");
    const r = await postJson(`/api/master/versions/${pending.id}`, { action: "approve", actor: actorPayload(actor) });
    setBusy(false);
    setConfirmOpen(false);
    if (r.status !== 200) return setError(r.data.error);
    setPublished(pending.version_no);
    setFlat((x) => (x ? { ...x, done: [...x.done, dataset] } : x));
  }

  const changes = result ? result.summary.added + result.summary.changed + result.summary.deleted : 0;
  const needsDeleteOk = !!result && result.summary.deleted > 0;
  const canSubmit = !!result?.ok && changes > 0 && actor.role !== "viewer" && (!needsDeleteOk || allowDelete) && !pending;
  const canApprove = actor.role === "approver" && pending && pending.submitted_by !== actor.name;

  return (
    <div className="space-y-4">
      <div className="card px-5 py-4">
        <Stepper current={step} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[380px_1fr]">
        {/* 左：取込設定 */}
        <div className="space-y-4">
          <section className="card">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-bold">取込設定</h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label htmlFor="ds" className="field-label">
                  対象マスター
                </label>
                <select id="ds" className="field" value={dataset} onChange={(e) => (setDataset(e.target.value), setResult(null), setPending(null), setPublished(null))} disabled={!!pending}>
                  {DATASETS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted">{ds.description}</p>
              </div>
              <fieldset disabled={!!pending}>
                <legend className="field-label">更新方式</legend>
                <div className="space-y-1.5">
                  {(
                    [
                      ["upsert", "差分更新", "追加・変更のみ。CSV にない行はそのまま残します（推奨）"],
                      ["replace", "全件置換", "CSV にない行は削除されます。削除の明示的な許可が必要です"],
                      ["delete", "削除指定", "CSV に記載したキーの行を削除します"],
                    ] as const
                  ).map(([v, l, d]) => (
                    <label
                      key={v}
                      className={`flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2.5 ${mode === v ? "border-brand bg-brand-soft/60" : "border-line hover:bg-canvas"}`}
                    >
                      <input type="radio" name="mode" className="mt-1 h-4 w-4 accent-brand" checked={mode === v} onChange={() => (setMode(v), setResult(null))} />
                      <span>
                        <span className="block text-[13px] font-medium">{l}</span>
                        <span className="block text-xs text-muted">{d}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <span className="field-label">CSV ファイル</span>
                <label
                  onDragOver={(e) => (e.preventDefault(), setDragging(true))}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const f = e.dataTransfer.files[0];
                    if (f && !pending) loadFile(f);
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center has-focus-visible:outline-2 has-focus-visible:outline-brand ${
                    dragging ? "border-brand bg-brand-soft" : "border-[#c9cbcd] bg-canvas hover:border-brand"
                  }`}
                >
                  <Upload size={20} className="text-muted" aria-hidden />
                  <span className="text-[13px] font-medium">{fileName || "ファイルを選択 または ドラッグ＆ドロップ"}</span>
                  <span className="text-[11px] text-muted">定型 CSV（UTF-8 / Shift_JIS）</span>
                  <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => {
                      const f = e.target.files?.[0];
                      // 同じファイルを修正して選び直せるよう、選択状態を毎回クリアする
                      e.target.value = "";
                      if (f) loadFile(f);
                    }} disabled={!!pending} />
                </label>
                <a href={`/api/master/export?dataset=${dataset}`} className="mt-2 inline-flex items-center gap-1 text-xs text-brand hover:underline">
                  <Download size={12} aria-hidden /> 現在の公開データを定型 CSV で取得（編集用ひな形）
                </a>
              </div>
            </div>
            <div className="flex gap-2 border-t border-line px-5 py-3.5">
              <button className="btn-primary flex-1" disabled={!csv || busy || !!pending} onClick={validate}>
                <ShieldCheck size={16} aria-hidden /> 形式を検証する
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  reset();
                  setFlat(null);
                }}
                disabled={busy}
              >
                やり直す
              </button>
            </div>
          </section>

          <details className="card group" open>
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-[13px] font-medium">
              テストデータ（ワンクリックで読込）
              <span className="text-xs font-normal text-muted group-open:hidden">表示</span>
            </summary>
            <p className="border-t border-line px-5 py-2.5 text-xs text-muted">
              {DBJ_SAMPLE ? (
                <>DBJ 様の CSV（既存形式）は、そのままアップロードして取り込めます。下の項目は差分・承認・エラー表示の確認用です。取り消した承認は「承認・更新履歴」から復元できます。</>
              ) : (
                <>
                  ①〜⑤を順番に「検証 → 申請 → 別の承認者で承認」すると、
                  <Link href="/search/vehicle?model=TEST-A100" className="text-brand hover:underline">TEST-A100</Link> などで検索できます。
                </>
              )}
            </p>
            <ul className="divide-y divide-line-soft border-t border-line">
              {TEST_FILES.map((s) => (
                <li key={s.file}>
                  <button onClick={() => loadSample(s)} className="flex w-full items-center gap-2 px-5 py-2 text-left hover:bg-canvas" disabled={!!pending}>
                    <span className="min-w-0 flex-1 text-[13px]">{s.label}</span>
                    <Badge tone={s.ok ? "success" : "error"}>{s.ok ? "正常" : "エラー"}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          </details>

          {/* サンプル CSV はデモ用データ前提のため、DBJ 様サンプル検証環境では表示しない */}
          {!DBJ_SAMPLE && <details className="card group">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-[13px] font-medium">
              検証用サンプル CSV
              <span className="text-xs font-normal text-muted group-open:hidden">表示</span>
            </summary>
            <ul className="divide-y divide-line-soft border-t border-line">
              {SAMPLES.map((s) => (
                <li key={s.file}>
                  <button onClick={() => loadSample(s)} className="flex w-full items-start gap-2 px-5 py-2.5 text-left hover:bg-canvas" disabled={!!pending}>
                    <FileSpreadsheet size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px]">{s.label}</span>
                      <span className="block truncate text-[11px] text-muted">{s.file}</span>
                    </span>
                    <Badge tone={s.ok ? "success" : "error"}>{s.ok ? "正常" : "エラー"}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          </details>}
        </div>

        {/* 右：検証・差分・承認・反映 */}
        <div className="min-w-0 space-y-4">
          {error && <AlertMessage variant="error" title="処理できませんでした">{error}</AlertMessage>}
          {notice && <AlertMessage variant="info">{notice}</AlertMessage>}

          {flat && (
            <section className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
                <h2 className="text-sm font-bold">DBJ 形式（{flat.result.format === "19" ? "19 列" : "旧 11 列"}）の CSV を変換しました</h2>
                {flat.result.ok ? <Badge tone="success">変換 OK</Badge> : <Badge tone="error">エラー {flat.result.errors.length} 件</Badge>}
                <span className="text-xs text-muted">{flat.name} ・ {flat.result.rowCount} 行</span>
              </div>
              <div className="space-y-3 px-5 py-4 text-[13px]">
                {flat.result.errors.length > 0 && (
                  <AlertMessage variant="error" title="エラーがあるため取り込めません">
                    <ul className="list-disc space-y-0.5 pl-4">
                      {flat.result.errors.slice(0, 200).map((e, i) => <li key={i}>{e}</li>)}
                      {flat.result.errors.length > 200 && <li>ほか {flat.result.errors.length - 200} 件（変換レポートで全件を確認できます）</li>}
                    </ul>
                  </AlertMessage>
                )}
                {flat.result.warnings.length > 0 && (
                  <AlertMessage variant="warning" title="ご確認ください">
                    <ul className="list-disc space-y-0.5 pl-4">
                      {flat.result.warnings.slice(0, 200).map((e, i) => <li key={i}>{e}</li>)}
                      {flat.result.warnings.length > 200 && <li>ほか {flat.result.warnings.length - 200} 件</li>}
                    </ul>
                  </AlertMessage>
                )}
                <details>
                  <summary className="cursor-pointer text-xs text-muted">変換時の扱いを表示</summary>
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted">
                    {flat.result.notes.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                </details>
                {flat.result.ok && (
                  <div>
                    <p className="mb-2 text-xs text-muted">参照関係があるため、上から順に「読込 → 検証 → 申請 → 別の承認者で承認」してください。変更がないマスターは次へ進んでください。</p>
                    <ol className="divide-y divide-line-soft rounded-lg border border-line">
                      {FLAT_ORDER.filter((id) => flat.result.csv[id]).map((id, i) => (
                        <li key={id} className="flex items-center gap-3 px-3 py-2">
                          <span className="w-5 text-center font-bold text-charcoal tnum">{i + 1}</span>
                          <span className="min-w-0 flex-1">
                            {getDataset(id)!.label} <span className="text-xs text-muted tnum">{flat.result.counts[id]} 件</span>
                          </span>
                          {flat.done.includes(id) ? (
                            <Badge tone="success">反映済み</Badge>
                          ) : (
                            <button className="btn-secondary btn-sm" onClick={() => loadFlatStep(id)} disabled={!!pending} aria-label={`${getDataset(id)!.label}を読み込む`}>
                              読込
                            </button>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </section>
          )}

          {step === 1 && !flat && (
            <section className="card px-5 py-10 text-center">
              <FileSpreadsheet size={28} className="mx-auto mb-2 text-subtle" aria-hidden />
              <div className="text-sm font-medium">CSV を選択してください</div>
              <p className="mx-auto mt-1 max-w-lg text-xs text-muted">
                自由形式の Excel は直接取り込めません。定型 CSV（1 行目が列名）のみ受け付けます。取り込んだ内容は承認されるまで検索結果に反映されません。
              </p>
              <p className="mx-auto mt-3 max-w-2xl text-[11px] break-all text-muted">
                列: <span className="font-mono">{ds.columns.map((c) => (c.required ? `${c.name}*` : c.name)).join(", ")}</span>（* は必須）
              </p>
            </section>
          )}

          {step === 2 && !result && (
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <h2 className="text-sm font-bold">読み込んだ CSV</h2>
                <span className="text-xs text-muted">{fileName}</span>
              </div>
              <pre className="max-h-72 overflow-auto bg-canvas px-5 py-3 font-mono text-xs leading-6">{csv.split(/\r?\n/).slice(0, 20).join("\n")}</pre>
              <div className="border-t border-line px-5 py-3 text-xs text-muted">「形式を検証する」を押すと、形式・必須項目・参照関係を確認し、差分を表示します。</div>
            </section>
          )}

          {result && (
            <section className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
                <h2 className="text-sm font-bold">検証結果</h2>
                {result.ok ? <Badge tone="success">形式 OK</Badge> : <Badge tone="error">エラー {result.errors.length} 件</Badge>}
                <span className="text-xs text-muted">
                  {result.rowCount} 行 ・ {ds.label} ・ {MODE_LABEL[mode].split("（")[0]} ・ 部分取込なし
                </span>
              </div>
              <div className="space-y-3 px-5 py-4">
                <DiffCounts s={result.summary} />
                {!result.ok && (
                  <AlertMessage variant="error" title="エラーがあるため申請できません">
                    1 件でもエラーがある場合、CSV 全体を取り込みません（不完全な更新を防ぐため）。修正して再度アップロードしてください。
                  </AlertMessage>
                )}
                {result.warnings.map((w) => (
                  <AlertMessage key={w} variant="warning">
                    {w}
                  </AlertMessage>
                ))}
              </div>
              {result.errors.length > 0 && (
                <div className="border-t border-line">
                  <h3 className="px-5 pt-3 pb-2 text-[13px] font-bold text-bad">
                    エラー行と理由
                    {((result as { error_total?: number }).error_total ?? 0) > result.errors.length && (
                      <span className="ml-2 font-normal text-muted">（全 {(result as { error_total?: number }).error_total} 件のうち先頭 {result.errors.length} 件）</span>
                    )}
                  </h3>
                  <div className="max-h-80 overflow-auto">
                    <table className="dt">
                      <thead>
                        <tr>
                          <th className="w-16">行</th>
                          <th className="w-32">列</th>
                          <th>理由</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((e, i) => (
                          <tr key={i}>
                            <td className="font-mono tnum">{e.line ?? "—"}</td>
                            <td className="text-xs">{e.column ? ds.columns.find((c) => c.name === e.column)?.label ?? e.column : "—"}</td>
                            <td>{e.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {result && result.diff.length > 0 && (
            <section className="card overflow-hidden">
              <div className="border-b border-line px-5 py-3.5">
                <h2 className="text-sm font-bold">差分一覧（現在の公開データとの比較）</h2>
              </div>
              <DiffPreview diff={result.diff} dataset={dataset} total={(result as { diff_total?: number }).diff_total} />
              {result.ok && !pending && (
                <div className="space-y-3 border-t border-line bg-canvas px-5 py-4">
                  {needsDeleteOk && (
                    <label className="flex items-start gap-2 rounded-lg border border-bad-line bg-bad-soft px-3 py-2.5 text-[13px]">
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-bad" checked={allowDelete} onChange={(e) => setAllowDelete(e.target.checked)} />
                      <span>
                        <span className="font-medium text-bad">{result.summary.deleted} 件の削除を許可する</span>
                        <span className="block text-xs text-ink/80">削除は明示的に許可した場合のみ申請できます。削除対象を差分一覧で確認してください。</span>
                      </span>
                    </label>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="btn-charcoal" onClick={submit} disabled={!canSubmit || busy}>
                      承認を申請する
                    </button>
                    <span className="text-xs text-muted">
                      {actor.role === "viewer" ? "閲覧者は申請できません" : "申請後、申請者以外の承認者が確認して本番に反映します"}
                    </span>
                  </div>
                </div>
              )}
            </section>
          )}

          {pending && !published && (
            <section className="card overflow-hidden border-warn-line">
              <div className="border-b border-line bg-warn-soft px-5 py-3.5">
                <h2 className="text-sm font-bold">
                  承認待ち：{ds.label} v{pending.version_no}
                </h2>
                <p className="mt-0.5 text-xs text-muted">申請者: {pending.submitted_by}。承認されるまで検索結果には反映されません。</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                <button className="btn-primary" disabled={!canApprove || busy} onClick={() => setConfirmOpen(true)}>
                  承認して本番に反映
                </button>
                <Link href="/history" className="btn-secondary">
                  承認・更新履歴を開く
                </Link>
                <span className="text-xs text-muted">
                  {actor.role !== "approver"
                    ? "承認は承認者のみ可能です（右上のアカウントメニューで切替）"
                    : pending.submitted_by === actor.name
                      ? "申請者本人は承認できません。別の承認者に切り替えてください"
                      : ""}
                </span>
              </div>
            </section>
          )}

          {published && (
            <AlertMessage variant="success" title={`本番反映が完了しました（${ds.label} v${published}）`} action={<button className="btn-secondary btn-sm" onClick={() => reset()}>続けて取込</button>}>
              検索結果に即時反映されました。旧版への復元は「承認・更新履歴」から行えます。
            </AlertMessage>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="本番データに反映しますか？"
        description={`${ds.label} を v${pending?.version_no} に更新します。反映後は直ちに検索結果へ影響します。`}
        confirmLabel="承認して反映する"
        acknowledge="差分の内容を確認しました"
        busy={busy}
        onConfirm={approve}
        onClose={() => setConfirmOpen(false)}
      >
        {result && <DiffCounts s={result.summary} />}
        <p className="mt-3 text-xs text-muted">反映前の版は自動的に保存され、いつでも復元できます。</p>
      </ConfirmDialog>
    </div>
  );
}
