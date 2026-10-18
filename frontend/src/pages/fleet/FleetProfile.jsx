import { LogOut } from 'lucide-react'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/ui/PageHeader'
import { useAuth } from '../../context/AuthContext'

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-app-borderMuted py-3 last:border-0">
      <dt className="text-[13px] text-text-secondary">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[13px] font-medium text-text-primary">{children}</dd>
    </div>
  )
}

export default function FleetProfile() {
  const { fullName, email, role, signOut } = useAuth()

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-6">
      <PageHeader title="Profile" subtitle="Your administrator account." />

      <Card radius="cardLg" className="p-6">
        <dl>
          <Row label="Name">{fullName || '—'}</Row>
          <Row label="Email">{email || '—'}</Row>
          <Row label="Role">{role === 'admin' ? 'Fleet Administrator' : role || '—'}</Row>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-text-muted">
          As a fleet administrator, your account can view and analyse all 20 vehicles in the fleet.
          Access is enforced by the server; the frontend role check is a secondary safeguard only.
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
