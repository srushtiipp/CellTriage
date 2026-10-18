import { Loader2 } from 'lucide-react'
import Card from './Card'
import Logo from './Logo'

/** Full-page message used while auth is resolving or when access is blocked. */
export default function StatusScreen({ loading = false, title, children, actions }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-10">
      <Card radius="cardLg" className="w-full max-w-md p-8 text-center">
        <div className="mb-6 flex justify-center">
          <Logo className="h-12" />
        </div>
        {loading && <Loader2 className="mx-auto mb-3 animate-spin text-accent" size={22} aria-hidden="true" />}
        <h1 className="font-display text-xl font-semibold text-text-primary" role={loading ? 'status' : undefined}>
          {title}
        </h1>
        {children && <div className="mt-2 text-[13px] leading-relaxed text-text-secondary">{children}</div>}
        {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
      </Card>
    </div>
  )
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="hover-edge rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-app-surface hover:bg-accent-strong disabled:opacity-60"
    >
      {children}
    </button>
  )
}

export function GhostButton({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="hover-edge rounded-md border border-app-border bg-app-surface px-4 py-2 text-[13px] font-medium text-text-primary hover:border-accent/40"
    >
      {children}
    </button>
  )
}
