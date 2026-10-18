const TONES = {
  good: 'bg-status-goodDim text-status-good',
  warn: 'bg-status-warnDim text-status-warn',
  bad: 'bg-status-badDim text-status-bad',
  neutral: 'bg-app-surface2 text-text-secondary',
}

export default function StatusPill({ tone = 'neutral', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}
