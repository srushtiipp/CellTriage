import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import StatusScreen, { GhostButton, PrimaryButton } from '../ui/StatusScreen'

/** Signed-in users only. Resolves the backend identity before rendering children. */
export function RequireAuth({ children }) {
  const { status, profileError, retryProfile, signOut } = useAuth()
  const location = useLocation()

  if (status === 'unconfigured') {
    return (
      <StatusScreen title="Sign-in is not configured">
        Set <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
        <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> in <code className="font-mono">.env</code>, then restart the dev server.
      </StatusScreen>
    )
  }
  if (status === 'loading') return <StatusScreen loading title="Checking your session…" />
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: location }} />

  if (status === 'error') {
    const kind = profileError?.kind
    let title = 'We could not load your account'
    let body = 'The server returned an unexpected response. Please try again.'
    if (kind === 'network' || kind === 'timeout') {
      title = 'Cannot reach the CellTriage server'
      body = 'Check your connection and that the backend is running, then try again.'
    } else if (kind === 'forbidden') {
      title = 'No CellTriage profile for this account'
      body = 'You are signed in, but your account has no profile or role. Contact your fleet administrator.'
    }
    return (
      <StatusScreen
        title={title}
        actions={
          <>
            {kind !== 'forbidden' && <PrimaryButton onClick={retryProfile}>Try again</PrimaryButton>}
            <GhostButton onClick={signOut}>Sign out</GhostButton>
          </>
        }
      >
        {body}
      </StatusScreen>
    )
  }
  return children
}

/**
 * Vehicle-user protected route.
 * Admins are redirected to /fleet instead of seeing an error message.
 * Unassigned vehicle users see an informative message.
 */
export function RequireVehicleUser({ children }) {
  const { role, vehicleIds, signOut } = useAuth()

  if (role === 'admin') {
    return <Navigate to="/fleet" replace />
  }

  if (role !== 'vehicle_user') {
    return (
      <StatusScreen
        title="Account role not recognised"
        actions={<GhostButton onClick={signOut}>Sign out</GhostButton>}
      >
        Your account has a role this application does not support. Contact your fleet administrator.
      </StatusScreen>
    )
  }
  if (vehicleIds.length === 0) {
    return (
      <StatusScreen title="No vehicle assigned" actions={<GhostButton onClick={signOut}>Sign out</GhostButton>}>
        Your account is not linked to a vehicle yet. Ask your fleet administrator to assign one.
      </StatusScreen>
    )
  }
  return children
}

/**
 * Admin-only protected route.
 * Vehicle users and unrecognised roles are denied access.
 */
export function RequireAdmin({ children }) {
  const { role, signOut } = useAuth()

  if (role !== 'admin') {
    return (
      <StatusScreen
        title="Administrator access required"
        actions={<GhostButton onClick={signOut}>Sign out</GhostButton>}
      >
        This section is only available to fleet administrators. If you believe this is an error, contact your fleet administrator.
      </StatusScreen>
    )
  }
  return children
}
