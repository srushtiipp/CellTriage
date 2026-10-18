import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Eye, EyeOff, Info, Loader2, Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import useTheme from '../hooks/useTheme'
import ThemeToggle from '../components/ui/ThemeToggle'
import Logo from '../components/ui/Logo'
import StatusScreen from '../components/ui/StatusScreen'

/** Turns a Supabase auth error into one clear sentence. */
function authMessage(error) {
  const code = (error?.code || '').toLowerCase()
  const msg = (error?.message || '').toLowerCase()
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return 'The email or password is incorrect.'
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return 'This email address has not been confirmed yet. Check your inbox or contact your administrator.'
  }
  if (code.includes('rate_limit') || msg.includes('too many') || error?.status === 429) {
    return 'Too many sign-in attempts. Please wait a minute and try again.'
  }
  if (msg.includes('fetch') || msg.includes('network') || error?.name === 'AuthRetryableFetchError') {
    return 'Cannot reach the sign-in service. Check your connection and try again.'
  }
  return 'Sign-in failed. Please check your details and try again.'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const { status, signIn, notice, clearNotice, role } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const progressed = useRef(false)

  const fromPath = location.state?.from?.pathname
  const defaultDest = role === 'admin' ? '/fleet' : '/'
  const destination = fromPath && fromPath !== '/login' ? fromPath : defaultDest

  // Once the backend identity is resolved (or failed) the route guards take over.
  useEffect(() => {
    if (status === 'ready' || status === 'error') navigate(destination, { replace: true })
  }, [status, destination, navigate])

  // Sign-in succeeded but the backend then rejected the session: stop the spinner and say so.
  useEffect(() => {
    if (!submitting) return
    if (status === 'loading') progressed.current = true
    if (status === 'signedOut' && progressed.current) {
      progressed.current = false
      setSubmitting(false)
      setError('You signed in, but the server did not accept the session. Please try again.')
    }
  }, [status, submitting])

  if (status === 'loading' && !submitting) return <StatusScreen loading title="Checking your session…" />

  const busy = submitting
  const unconfigured = status === 'unconfigured'

  const onSubmit = async (e) => {
    e.preventDefault()
    if (busy || unconfigured) return
    setError('')
    clearNotice()

    const trimmed = email.trim()
    if (!trimmed || !password) {
      setError('Enter your email address and password.')
      return
    }
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address.')
      return
    }

    progressed.current = false
    setSubmitting(true)
    const { error: authError } = await signIn(trimmed, password)
    if (authError) {
      setError(authMessage(authError))
      setSubmitting(false)
    }
    // On success the session event moves `status` forward and the effect above navigates.
  }

  const fieldClass =
    'w-full rounded-md border border-app-border bg-app-surface py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60'

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-app-bg px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      <div className="grid w-full max-w-4xl overflow-hidden rounded-cardLg border border-app-border bg-app-surface shadow-lift lg:grid-cols-2">
        <section className="flex flex-col justify-between gap-10 border-b border-app-border bg-app-sidebar p-8 lg:border-b-0 lg:border-r lg:p-10">
          <Logo className="h-20" />
          <div>
            <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary">Know your battery's condition.</h1>
            <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">
              Follow the health, charging sessions and telemetry of your assigned EV battery, and ask the assistant about what the data shows.
            </p>
          </div>
        </section>

        <section className="p-8 lg:p-10">
          <h2 className="font-sans text-xl font-semibold text-text-primary">Sign in</h2>
          <p className="mt-1 text-[13px] text-text-secondary">Use the account your fleet administrator created for you.</p>

          <div className="mt-5 space-y-3" aria-live="polite">
            {notice === 'expired' && (
              <div role="status" className="flex items-start gap-2.5 rounded-card border border-status-warn/30 bg-status-warnDim px-3.5 py-2.5 text-[13px] text-text-primary">
                <Info size={15} className="mt-0.5 shrink-0 text-status-warn" aria-hidden="true" />
                Your session has expired. Please sign in again.
              </div>
            )}
            {unconfigured && (
              <div role="alert" className="flex items-start gap-2.5 rounded-card border border-status-bad/30 bg-status-badDim px-3.5 py-2.5 text-[13px] text-text-primary">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-status-bad" aria-hidden="true" />
                <span>
                  Sign-in is not configured. Set <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
                  <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> in <code className="font-mono">.env</code>.
                </span>
              </div>
            )}
            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-card border border-status-bad/30 bg-status-badDim px-3.5 py-2.5 text-[13px] text-text-primary">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-status-bad" aria-hidden="true" />
                {error}
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4" aria-busy={busy}>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-text-secondary">
                Email address
              </label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy || unconfigured}
                  placeholder="you@example.com"
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-text-secondary">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy || unconfigured}
                  placeholder="Your password"
                  className={`${fieldClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-text-muted hover:text-text-primary"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || unconfigured}
              className="hover-edge flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-app-surface hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-text-muted">Forgotten your password? Contact your fleet administrator.</p>
        </section>
      </div>
    </div>
  )
}
