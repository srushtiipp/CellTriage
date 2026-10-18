import { AlertTriangle, Info, RefreshCw } from 'lucide-react'

const TONES = {
  info: { box: 'border-app-border bg-app-surface2 text-text-secondary', icon: 'text-text-muted', Icon: Info },
  warn: { box: 'border-status-warn/30 bg-status-warnDim text-text-primary', icon: 'text-status-warn', Icon: AlertTriangle },
  bad: { box: 'border-status-bad/30 bg-status-badDim text-text-primary', icon: 'text-status-bad', Icon: AlertTriangle },
}

/**
 * Inline message used for errors, empty states and honest data limitations.
 * Pass `onRetry` to show a retry button.
 */
export default function Notice({ tone = 'info', title, children, onRetry, className = '' }) {
  const { box, icon, Icon } = TONES[tone] || TONES.info
  return (
    <div role={tone === 'bad' ? 'alert' : 'note'} className={`flex items-start gap-3 rounded-card border px-4 py-3 text-[13px] leading-relaxed ${box} ${className}`}>
      <Icon size={16} className={`mt-0.5 shrink-0 ${icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-text-primary">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="hover-edge inline-flex shrink-0 items-center gap-1.5 rounded-md border border-app-border bg-app-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:border-accent/40"
        >
          <RefreshCw size={12} /> Retry
        </button>
      )}
    </div>
  )
}
