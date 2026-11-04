import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AlertMessage } from "./alert-message";
import { SectionTitle } from "./page-header";
import { Badge } from "./status-badge";

// DBJ 様サンプル検証環境のダッシュボードに表示する検証ガイド（期待結果は回帰テストで確認済み）
const CASES: { id: string; purpose: string; model: string; reg?: string; result: string; tone: "success" | "warning" | "error" }[] = [
  { id: "1", purpose: "通常の適合検索", model: "DBA-NSP130", reg: "2015-04", result: "確認済み DBJ-B24L", tone: "success" },
  { id: "2", purpose: "年式分岐（期間内）", model: "DBA-NSP130", reg: "2019-05", result: "確認済み DBJ-Q85", tone: "success" },
  { id: "1・2", purpose: "年式分岐（年月なし）", model: "DBA-NSP130", result: "確認要：初度登録年月が不足", tone: "warning" },
  { id: "3", purpose: "ハイブリッド車", model: "DAA-NHP10", result: "確認済み DBJ-LN1", tone: "success" },
  { id: "4", purpose: "通常の適合検索", model: "DBA-GK3", reg: "2016-03", result: "確認済み DBJ-N65", tone: "success" },
  { id: "5", purpose: "条件不足で回答停止", model: "DBA-GK3", reg: "2019-01", result: "確認要：回答しない", tone: "warning" },
  { id: "6", purpose: "他メーカー同一製品", model: "DBA-E12", result: "確認済み DBJ-Q85", tone: "success" },
  { id: "7", purpose: "電源方式", model: "DAA-HE12", result: "確認済み DBJ-LN2", tone: "success" },
  { id: "8", purpose: "ISS 対応規格", model: "DBA-DJ3FS", result: "確認済み DBJ-M55", tone: "success" },
  { id: "9", purpose: "LN EFB 規格", model: "DBA-GT7", result: "確認済み DBJ-LN3EFB", tone: "success" },
  { id: "10", purpose: "軽自動車", model: "DBA-MH34S", result: "確認済み DBJ-M42", tone: "success" },
  { id: "11", purpose: "軽自動車の共通品番", model: "DBA-LA600S", result: "確認済み DBJ-M42", tone: "success" },
  { id: "12", purpose: "JIS 大型規格", model: "DBA-GF8W", result: "確認済み DBJ-D23L", tone: "success" },
  { id: "13", purpose: "欧州車 LN 規格", model: "3BA-5F20", result: "確認済み DBJ-LN4", tone: "success" },
  { id: "14", purpose: "顧客回答不可", model: "3DA-205004", result: "確認要：回答しない", tone: "warning" },
  { id: "15", purpose: "未登録・顧客回答不可", model: "TEST-US-001", result: "確認要：回答しない", tone: "warning" },
  { id: "—", purpose: "CSV にない型式", model: "DBA-ZZ999", result: "未登録", tone: "error" },
];

export function SampleGuide() {
  return (
    <div className="mb-8 space-y-4">
      <AlertMessage variant="warning" title="この環境の前提（サンプル CSV にない情報の仮の扱い）">
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>年式は仮に「初度登録」基準として比較しています。実際の基準をご確認ください。</li>
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
            <Link href="/master" className="text-xs text-action hover:underline">
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
              {CASES.map((c) => (
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
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-action hover:underline"
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
