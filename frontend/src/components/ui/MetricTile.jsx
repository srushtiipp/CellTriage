import Skeleton from './Skeleton'

/** One labelled value. `value` null/undefined renders an em dash, never 0. */
export default function MetricTile({ label, value, hint, loading, error, icon: Icon }) {
  return (
    <div className="flex h-full flex-col justify-between rounded-card border border-app-border bg-app-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">{label}</p>
        {Icon && <Icon size={14} strokeWidth={1.75} className="text-text-muted" aria-hidden="true" />}
      </div>
      <div className="mt-2">
        {loading ? (
          <Skeleton className="h-6 w-20" />
        ) : error ? (
          <p className="text-[13px] text-status-bad">Unavailable</p>
        ) : (
          <p className="text-[22px] font-semibold leading-none text-text-primary tabular">{value ?? '—'}</p>
        )}
        {hint && <p className="mt-1.5 text-[11px] text-text-muted">{hint}</p>}
      </div>
    </div>
  )
}
