import { EmptyState } from "./empty-state";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  className?: string;
  /** 横スクロール時に左端へ固定する列（幅を px で指定） */
  sticky?: { left: number; width: number };
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "データがありません",
  caption,
  maxHeight,
  rowClassName,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  empty?: string;
  caption?: string;
  maxHeight?: number;
  rowClassName?: (row: T) => string;
}) {
  if (!rows.length) return <EmptyState title={empty} compact />;
  const stickyStyle = (c: Column<T>) => (c.sticky ? { left: c.sticky.left, minWidth: c.sticky.width, maxWidth: c.sticky.width } : undefined);
  return (
    <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table className="dt">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" style={stickyStyle(c)} className={`${c.sticky ? "z-[2] sticky" : ""} ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className={rowClassName?.(r)}>
              {columns.map((c) => (
                <td key={c.key} style={stickyStyle(c)} className={`${c.sticky ? "sticky z-[1] bg-surface" : ""} ${c.className ?? ""}`}>
                  {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
