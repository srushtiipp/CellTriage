import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, LogOut, Menu, User } from 'lucide-react'
import useTheme from '../../hooks/useTheme'
import ThemeToggle from '../ui/ThemeToggle'
import { useAuth } from '../../context/AuthContext'
import { useVehicleData } from '../../context/VehicleDataContext'
import { riskInfo } from '../../lib/risk'

const DOT = { good: 'bg-status-good', warn: 'bg-status-warn', bad: 'bg-status-bad', neutral: 'bg-text-muted' }

function VehicleChip() {
  const { vehicleId, vehicleIds, setVehicleId, timeline, health } = useVehicleData()
  const latest = timeline.withHealth.at(-1) ?? null
  const tone = riskInfo(latest?.health?.risk_level).tone
  const sessionText =
    health.status === 'loading'
      ? 'Loading…'
      : latest?.session_id != null
        ? `Latest recorded: session ${latest.session_id}`
        : 'No sessions recorded'

  return (
    <div className="hidden items-center gap-3 rounded-md border border-app-border bg-app-surface px-3 py-1.5 sm:flex">
      <div className="flex items-center gap-1.5 border-r border-app-border pr-3">
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
        {vehicleIds.length > 1 ? (
          <label className="flex items-center">
            <span className="sr-only">Vehicle</span>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="cursor-pointer bg-transparent text-xs font-medium text-text-secondary focus:outline-none"
            >
              {vehicleIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="text-xs font-medium text-text-secondary">Vehicle {vehicleId}</span>
        )}
      </div>
      <span className="font-mono text-[11px] text-text-muted">{sessionText}</span>
    </div>
  )
}

function AccountMenu() {
  const { fullName, email, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const name = fullName || email || 'Account'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="hover-edge flex items-center gap-1.5 rounded-md border border-transparent py-1 pl-1 pr-2 text-text-secondary hover:border-app-border hover:bg-app-surface2 hover:text-text-primary"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-dim text-accent-strong">
          <User size={14} />
        </span>
        <ChevronDown size={13} className="hidden text-text-muted sm:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-56 rounded-card border border-app-border bg-app-surface p-1.5 shadow-lift">
          <div className="border-b border-app-borderMuted px-2.5 pb-2 pt-1.5">
            <p className="truncate text-[13px] font-semibold text-text-primary">{name}</p>
            {fullName && email && <p className="truncate text-[11px] text-text-muted">{email}</p>}
          </div>
          <Link
            to="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="hover-edge mt-1 flex items-center gap-2 rounded px-2.5 py-2 text-[13px] text-text-secondary hover:bg-app-surface2 hover:text-text-primary"
          >
            <User size={14} /> Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="hover-edge flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[13px] text-text-secondary hover:bg-app-surface2 hover:text-text-primary"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Header({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <header className="flex h-[4.5rem] shrink-0 items-center justify-between gap-4 border-b border-app-border/70 bg-app-bg/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="hover-edge rounded-md p-2 text-text-secondary hover:bg-app-surface2 hover:text-text-primary lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold uppercase tracking-wideish text-text-primary sm:text-sm">CellTriage</p>
          <p className="hidden truncate text-xs text-text-muted sm:block">Vehicle health, telemetry &amp; degradation</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <VehicleChip />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <AccountMenu />
      </div>
    </header>
  )
}
