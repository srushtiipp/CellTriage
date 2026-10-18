import { useParams, Link, NavLink, Outlet } from 'react-router-dom'
import { ArrowLeft, Activity, BatteryCharging, Box, Grid3x3, HeartPulse, LayoutDashboard } from 'lucide-react'
import { AdminVehicleDataProvider } from '../../context/AdminVehicleDataContext'
import Notice from '../../components/ui/Notice'

const TABS = [
  { to: '', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: 'battery-health', label: 'Battery Health', icon: HeartPulse },
  { to: 'digital-twin', label: 'Digital Twin', icon: Box },
  { to: 'cell-diagnostics', label: 'Cell Diagnostics', icon: Grid3x3 },
  { to: 'charging', label: 'Charging', icon: BatteryCharging },
]

function VehicleTab({ to, label, icon: Icon, base, end }) {
  const target = end ? base : `${base}/${to}`
  return (
    <NavLink
      to={target}
      end={end}
      className={({ isActive }) =>
        [
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
          isActive
            ? 'bg-accent-dim text-accent-strong'
            : 'text-text-secondary hover:bg-app-surface2 hover:text-text-primary',
        ].join(' ')
      }
    >
      <Icon size={14} strokeWidth={1.75} />
      {label}
    </NavLink>
  )
}

export default function FleetVehicleDetail() {
  const { vehicleId } = useParams()

  if (!vehicleId) {
    return (
      <Notice tone="bad" title="No vehicle selected">
        Navigate from the fleet vehicles list to inspect a specific vehicle.
      </Notice>
    )
  }

  const base = `/fleet/vehicles/${encodeURIComponent(vehicleId)}`

  return (
    <AdminVehicleDataProvider vehicleId={vehicleId}>
      <div className="space-y-5 pb-6">
        {/* Back nav + vehicle ID */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/fleet/vehicles"
              className="hover-edge inline-flex items-center gap-1.5 rounded-md border border-app-border bg-app-surface px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:border-accent/40 hover:text-text-primary"
            >
              <ArrowLeft size={14} /> All Vehicles
            </Link>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Vehicle</p>
              <p className="font-mono text-[18px] font-semibold leading-tight text-text-primary">{vehicleId}</p>
            </div>
          </div>

          {/* Comparison link */}
          <Link
            to={`/fleet/compare?ids=${encodeURIComponent(vehicleId)}`}
            className="hover-edge inline-flex items-center gap-1.5 rounded-md border border-app-border bg-app-surface px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:border-accent/40 hover:text-text-primary"
          >
            <Activity size={14} /> Compare
          </Link>
        </div>

        {/* Tabs */}
        <nav aria-label="Vehicle sections" className="flex flex-wrap gap-1">
          {TABS.map((tab) => (
            <VehicleTab key={tab.to} {...tab} base={base} />
          ))}
        </nav>

        {/* Page content — rendered by the nested route */}
        <Outlet />
      </div>
    </AdminVehicleDataProvider>
  )
}
