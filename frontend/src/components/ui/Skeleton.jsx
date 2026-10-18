export default function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-app-surface2 ${className}`} />
}
