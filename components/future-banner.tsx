import { Lock } from "lucide-react";
import { PageHeader } from "./page-header";

/** 将来拡張（Phase 1 未実装）画面の共通ヘッダー */
export function FutureHeader({ title, option, description, reuse }: { title: string; option: string; description: string; reuse: string }) {
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        badge={
          <span className="inline-flex items-center gap-1 rounded-md bg-line-soft px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line ring-inset">
            <Lock size={11} aria-hidden /> {option}・Phase 1 未実装
          </span>
        }
      />
      <div className="mb-6 flex flex-col gap-1 rounded-card border border-dashed border-[#c9cbcd] bg-surface px-4 py-3 text-[13px] md:flex-row md:items-center md:gap-4">
        <span className="font-bold text-ink">将来拡張のプレビューです</span>
        <span className="text-muted">
          本番の社内業務では使用しません。{reuse}
        </span>
      </div>
    </>
  );
}
