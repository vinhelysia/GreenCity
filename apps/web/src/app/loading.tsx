export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="min-w-0 space-y-4">
      <p className="text-sm font-medium text-muted">Đang tải…</p>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="skeleton h-8 w-2/5 max-w-xs" />
        <div className="skeleton h-4 w-4/5 max-w-xl" />
        <div className="skeleton h-4 w-3/5 max-w-lg" />
        <div className="skeleton mt-4 h-36 w-full" />
      </div>
    </div>
  );
}
