import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AlertMessage } from "./alert-message";
import { SectionTitle } from "./page-header";
import { Badge } from "./status-badge";

// DBJ 様サンプル検証環境のダッシュボードに表示する検証ガイド（期待結果は回帰テストで確認済み）
type GuideRow = { id: string; purpose: string; model: string; reg?: string; result: string; tone: "success" | "warning" | "error" };
const CASES: GuideRow[] = [
  { id: "1", purpose: "通常の適合検索", model: "DBA-NSP130", reg: "2015-04", result: "確認済み DBJ-B24L", tone: "success" },
  { id: "2", purpose: "年式分岐（期間内）", model: "DBA-NSP130", reg: "2019-05", result: "確認済み DBJ-Q85", tone: "success" },
  { id: "1・2", purpose: "年式分岐（年月なし）", model: "DBA-NSP130", result: "確認要：初度登録年月が不足", tone: "warning" },
  { id: "3", purpose: "年月なし（候補 1 件でも確定しない）", model: "DAA-NHP10", result: "確認要：適用期間を表示", tone: "warning" },
  { id: "3", purpose: "ハイブリッド車", model: "DAA-NHP10", reg: "2017-06", result: "確認済み DBJ-LN1", tone: "success" },
  { id: "4", purpose: "通常の適合検索", model: "DBA-GK3", reg: "2016-03", result: "確認済み DBJ-N65", tone: "success" },
  { id: "5", purpose: "条件不足で回答停止", model: "DBA-GK3", reg: "2019-01", result: "確認要：回答しない", tone: "warning" },
  { id: "6", purpose: "他メーカー同一製品", model: "DBA-E12", reg: "2016-05", result: "確認済み DBJ-Q85", tone: "success" },
  { id: "7", purpose: "電源方式", model: "DAA-HE12", reg: "2018-09", result: "確認済み DBJ-LN2", tone: "success" },
  { id: "8", purpose: "ISS 対応規格", model: "DBA-DJ3FS", reg: "2017-11", result: "確認済み DBJ-M55", tone: "success" },
  { id: "9", purpose: "LN EFB 規格", model: "DBA-GT7", reg: "2019-04", result: "確認済み DBJ-LN3EFB", tone: "success" },
  { id: "10", purpose: "軽自動車", model: "DBA-MH34S", reg: "2015-02", result: "確認済み DBJ-M42", tone: "success" },
  { id: "11", purpose: "軽自動車の共通品番", model: "DBA-LA600S", reg: "2016-08", result: "確認済み DBJ-M42", tone: "success" },
  { id: "12", purpose: "JIS 大型規格", model: "DBA-GF8W", reg: "2017-03", result: "確認済み DBJ-D23L", tone: "success" },
  { id: "13", purpose: "欧州車 LN 規格", model: "3BA-5F20", reg: "2020-06", result: "確認済み DBJ-LN4", tone: "success" },
  { id: "14", purpose: "顧客回答不可", model: "3DA-205004", reg: "2019-07", result: "確認要：回答しない", tone: "warning" },
  { id: "15", purpose: "未登録・顧客回答不可", model: "TEST-US-001", reg: "2021-05", result: "確認要：回答しない", tone: "warning" },
  { id: "—", purpose: "CSV にない型式", model: "DBA-ZZ999", reg: "2020-01", result: "未登録", tone: "error" },
];

type CaseRow = { case_id: string; model_code: string };

/** 実車確認記録は DB に登録された内容から行を作る（実データをソースコードに含めない） */
export function SampleGuide({ cases = [] }: { cases?: CaseRow[] }) {
  const rows: GuideRow[] = [
    ...CASES,
    ...cases.flatMap((c) => [
      { id: "実車", purpose: "実車確認記録（1 台限定）を型式で検索", model: c.model_code, result: "確認要：記録を参考表示・自動回答なし", tone: "warning" as const },
      { id: "実車", purpose: "管理ID で記録を表示", model: c.case_id, result: "確認要：記録を参考表示", tone: "warning" as const },
    ]),
  ];
  return (
    <div className="mb-8 space-y-4">
      <AlertMessage variant="warning" title="この環境の前提（サンプル CSV にない情報の仮の扱い）">
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>年式は「初度登録」基準として比較します（ご回答どおり）。</li>
          <li>初度登録年月が未入力の場合は、候補が 1 件でも確定せず、適用期間を表示して「確認要」とします（ご回答どおり）。</li>
          <li>実車 1 台に限る記録（管理ID 付き）は「実車確認記録」に分けて登録し、型式検索では参考表示のみで自動回答には使いません。</li>
          <li>「2015/04」のような単月表記は、その月のみとして扱います（他の月は「該当なし」）。</li>
          <li>車名の列がないためメーカー名を表示し、すべて「主機・1 個」で登録しています。</li>
          <li>承認者・承認日の列がないため、承認者は「DBJ 元データ（確認済み）」としています。</li>
          <li>reply_template は取り込まず、回答文は承認済みの品番から自動で作成します。</li>
          <li>他社品番・容量・寸法はサンプルに含まれないため表示されません。ログインは本番で実装します。</li>
        </ul>
      </AlertMessage>
      <section className="card overflow-hidden">
        <SectionTitle
          aside={
            <Link href="/master" className="text-xs text-brand hover:underline">
              CSV 取込を試す
            </Link>
          }
        >
          DBJ 様サンプルの検証ガイド（「検索」で該当の条件を入力して実行します）
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="dt min-w-[720px]">
            <thead>
              <tr>
                <th>ID</th>
                <th>確認内容</th>
                <th>型式</th>
                <th>初度登録年月</th>
                <th>期待する結果</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={`${c.id}-${c.model}-${c.reg ?? ""}`}>
                  <td className="tnum whitespace-nowrap">{c.id}</td>
                  <td>{c.purpose}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{c.model}</td>
                  <td className="tnum text-xs whitespace-nowrap">{c.reg ?? "—"}</td>
                  <td>
                    <Badge tone={c.tone}>{c.result}</Badge>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <Link
                      href={`/search/vehicle?model=${encodeURIComponent(c.model)}${c.reg ? `&reg=${c.reg}` : ""}`}
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline"
                    >
                      検索 <ArrowRight size={13} aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
