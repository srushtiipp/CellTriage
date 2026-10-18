import { LogOut } from 'lucide-react'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useVehicleData } from '../context/VehicleDataContext'

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-app-borderMuted py-3 last:border-0">
      <dt className="text-[13px] text-text-secondary">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[13px] font-medium text-text-primary">{children}</dd>
    </div>
  )
}

export default function Profile() {
  const { fullName, email, role, signOut } = useAuth()
  const { vehicleId, vehicleIds } = useVehicleData()

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-6">
      <PageHeader title="Profile" subtitle="Your account and the vehicle you can view." />

      <Card radius="cardLg" className="p-6">
        <dl>
          <Row label="Name">{fullName || '—'}</Row>
          <Row label="Email">{email || '—'}</Row>
          <Row label="Role">{role === 'vehicle_user' ? 'Vehicle user' : role || '—'}</Row>
          <Row label={vehicleIds.length > 1 ? 'Assigned vehicles' : 'Assigned vehicle'}>
            <span className="font-mono">{vehicleIds.join(', ')}</span>
          </Row>
          {vehicleIds.length > 1 && (
            <Row label="Currently viewing">
              <span className="font-mono">{vehicleId}</span>
            </Row>
          )}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-text-muted">
          You can only see data for your assigned vehicle. This is enforced by the server, not by this page.
        </p>
      </Card>

      <button
        type="button"
        onClick={signOut}
        className="hover-edge inline-flex items-center gap-2 rounded-md border border-app-border bg-app-surface px-4 py-2 text-[13px] font-medium text-text-primary hover:border-accent/40"
      >
        <LogOut size={15} /> Sign out
      </button>
    </div>
  )
}
