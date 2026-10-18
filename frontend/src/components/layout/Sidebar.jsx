import { NavLink } from 'react-router-dom'
import { Gauge, HeartPulse, Box, Grid3x3, BatteryCharging, Sparkles, User } from 'lucide-react'
import Logo from '../ui/Logo'
import { useVehicleData } from '../../context/VehicleDataContext'

const NAV_GROUPS = [
  {
    label: 'Monitoring',
    items: [
      { to: '/', label: 'Command Center', icon: Gauge, end: true },
      { to: '/battery-health', label: 'Battery Health', icon: HeartPulse },
      { to: '/digital-twin', label: 'Digital Twin', icon: Box },
      { to: '/cell-diagnostics', label: 'Cell Diagnostics', icon: Grid3x3 },
      { to: '/charging', label: 'Charging', icon: BatteryCharging },
    ],
  },
  {
    label: 'Intelligence',
    items: [{ to: '/ai-assistant', label: 'AI Assistant', icon: Sparkles }],
  },
  {
    label: 'Account',
    items: [{ to: '/profile', label: 'Profile', icon: User }],
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

export default function Sidebar({ onNavigate }) {
  const { vehicleId } = useVehicleData()
  return (
    <aside className="flex h-full w-full flex-col bg-app-sidebar">
      <div className="flex items-center gap-2.5 border-b border-app-border/70 px-4 py-3.5">
        <Logo className="h-9 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-tight text-text-primary">CellTriage</p>
          <p className="truncate text-[10px] text-text-muted">Battery Intelligence</p>
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-5 overflow-y-auto px-3 py-4" onClick={onNavigate}>
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

      <div className="border-t border-app-border/70 px-6 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Assigned vehicle</p>
        <p className="mt-0.5 truncate font-mono text-[12px] text-text-secondary">{vehicleId}</p>
      </div>
    </aside>
  )
}
