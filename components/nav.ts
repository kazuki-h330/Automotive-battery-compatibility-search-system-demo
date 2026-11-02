import {
  Car,
  FileSpreadsheet,
  GitCompareArrows,
  History,
  LayoutDashboard,
  MessageCircle,
  ScanText,
  Search,
  Send,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; description?: string };

export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/search/vehicle", label: "車両から検索", icon: Car, description: "型式・初度登録年月などから適合する自社品番を確認" },
  { href: "/search/battery", label: "バッテリー品番検索", icon: Search, description: "現物品番・規格表記から自社の置換品番を確認" },
  { href: "/compare", label: "メーカー品番比較", icon: GitCompareArrows, description: "規格区分ごとに各社品番と自社品番を横並びで比較" },
  { href: "/master", label: "CSVマスター管理", icon: FileSpreadsheet, description: "定型 CSV の取込・検証・差分確認・反映" },
  { href: "/history", label: "承認・更新履歴", icon: History },
  { href: "/settings", label: "システム設定", icon: Settings },
];

/** Phase 1 では未実装。将来拡張のプレビューとして区別して表示する */
export const FUTURE_NAV: NavItem[] = [
  { href: "/future/line", label: "LINE受付・検索連携", icon: MessageCircle },
  { href: "/future/ocr", label: "車検証OCR受付", icon: ScanText },
  { href: "/future/auto-reply", label: "自動返信", icon: Send },
];

export function titleFor(path: string) {
  const all = [...MAIN_NAV, ...FUTURE_NAV];
  const hit = all.filter((n) => (n.href === "/" ? path === "/" : path.startsWith(n.href))).sort((a, b) => b.href.length - a.href.length)[0];
  return hit?.label ?? "";
}
