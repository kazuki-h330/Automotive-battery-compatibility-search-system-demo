import { RotateCcw, Search } from "lucide-react";

/** 検索フォームの枠（タイトル・入力欄・検索／クリアボタン） */
export function SearchForm({
  title,
  description,
  children,
  onSubmit,
  onClear,
  loading,
  submitLabel = "検索",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onSubmit: () => void;
  onClear: () => void;
  loading?: boolean;
  submitLabel?: string;
}) {
  return (
    <form
      className="card"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-bold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <div className="space-y-4 px-5 py-4">{children}</div>
      <div className="flex gap-2 border-t border-line px-5 py-3.5">
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          <Search size={16} aria-hidden /> {loading ? "検索中…" : submitLabel}
        </button>
        <button type="button" className="btn-secondary" onClick={onClear}>
          <RotateCcw size={15} aria-hidden /> 条件クリア
        </button>
      </div>
    </form>
  );
}

export function Field({
  id,
  label,
  required,
  hint,
  highlight,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  highlight?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {required ? (
          <span className="rounded bg-bad-soft px-1 text-[10px] font-medium text-bad">必須</span>
        ) : (
          <span className="text-[11px] font-normal text-subtle">任意</span>
        )}
      </label>
      {children}
      {highlight ? (
        <p className="mt-1 text-xs font-medium text-warn-ink">{highlight}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

/** 検証用の入力例（受入試験パターン） */
export function ExampleChips<T>({ title, items, onPick }: { title: string; items: { label: string; q: T }[]; onPick: (q: T) => void }) {
  return (
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-[13px] font-medium">
        {title}
        <span className="text-xs font-normal text-muted group-open:hidden">表示</span>
      </summary>
      <div className="flex flex-wrap gap-1.5 border-t border-line px-5 py-3">
        {items.map((e) => (
          <button
            key={e.label}
            type="button"
            className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink/80 hover:border-action hover:text-action"
            onClick={() => onPick(e.q)}
          >
            {e.label}
          </button>
        ))}
      </div>
    </details>
  );
}
