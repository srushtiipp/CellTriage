import { NavLink } from 'react-router-dom'
import { BarChart3, Bot, Car, ChevronRight, ClipboardCheck, Gauge, User } from 'lucide-react'
import Logo from '../ui/Logo'
import { useAuth } from '../../context/AuthContext'

const NAV_GROUPS = [
  {
    label: 'Fleet',
    items: [
      { to: '/fleet', label: 'Fleet Overview', icon: Gauge, end: true },
      { to: '/fleet/vehicles', label: 'All Vehicles', icon: Car },
      { to: '/fleet/compare', label: 'Compare Vehicles', icon: BarChart3 },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/fleet/copilot', label: 'Fleet AI Copilot', icon: Bot },
      { to: '/fleet/model-validation', label: 'Model Validation', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Account',
    items: [{ to: '/fleet/profile', label: 'Profile', icon: User }],
  },
]

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
          isActive ? 'bg-accent-dim text-accent-strong' : 'text-text-secondary hover:bg-app-surface2 hover:text-text-primary',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />}
          <Icon size={15} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export default function AdminSidebar({ onNavigate }) {
  const { fullName, email } = useAuth()
  const displayName = fullName || email || 'Administrator'

  return (
    <aside className="flex h-full w-full flex-col bg-app-sidebar">
      <div className="flex items-center gap-2.5 border-b border-app-border/70 px-4 py-3.5">
        <Logo className="h-9 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-tight text-text-primary">CellTriage</p>
          <p className="truncate text-[10px] text-text-muted">Fleet Administration</p>
        </div>
      </div>

      <nav aria-label="Fleet administration" className="flex-1 space-y-5 overflow-y-auto px-3 py-4" onClick={onNavigate}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-app-border/70 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Signed in as</p>
        <p className="mt-0.5 truncate text-[12px] text-text-secondary">{displayName}</p>
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-accent-strong">
          <ChevronRight size={10} />
          <span className="font-medium">Administrator</span>
        </div>
      </div>
    </aside>
  )
}
