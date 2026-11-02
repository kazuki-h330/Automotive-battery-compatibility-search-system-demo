export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-line-soft ${className}`} />;
}

export function LoadingSkeleton({ variant = "result" }: { variant?: "result" | "table" }) {
  return (
    <div className="card space-y-4 p-5" aria-busy="true" aria-label="読み込み中">
      {variant === "result" ? (
        <>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-16 w-40" />
            <Skeleton className="h-16 w-40" />
          </div>
          <Skeleton className="h-24 w-full" />
        </>
      ) : (
        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)
      )}
    </div>
  );
}
