/**
 * AdminVehicleDataContext: provides the same data shape as VehicleDataContext
 * but for an admin-selected vehicle (from the URL), not the logged-in user's vehicle.
 *
 * Admin pages that render user-side components (BatteryHealth, Charging, etc.)
 * can use this provider in place of VehicleDataProvider.
 *
 * The context object is exported so VehicleDataContext.useVehicleData() can
 * fall back to it when the user-side context is not present.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getHealthRecords, getMetricRecords, getSummary } from '../services/api'
import { buildTimeline } from '../lib/sessions'

export const AdminVehicleDataContext = createContext(null)
const LOADING = { status: 'loading', data: null, error: null }

export function AdminVehicleDataProvider({ vehicleId, children }) {
  const [state, setState] = useState({ summary: LOADING, health: LOADING, metrics: LOADING })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!vehicleId) return undefined
    const controller = new AbortController()
    const { signal } = controller
    setState({ summary: LOADING, health: LOADING, metrics: LOADING })

    const run = async (name, fn) => {
      try {
        const data = await fn()
        if (!signal.aborted) setState((s) => ({ ...s, [name]: { status: 'ready', data, error: null } }))
      } catch (error) {
        if (signal.aborted || error?.kind === 'aborted') return
        setState((s) => ({ ...s, [name]: { status: 'error', data: null, error } }))
      }
    }

    run('summary', () => getSummary(vehicleId, signal))
    run('health', () => getHealthRecords(vehicleId, signal))
    run('metrics', () => getMetricRecords(vehicleId, signal))

    return () => controller.abort()
  }, [vehicleId, tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])

  const timeline = useMemo(
    () => buildTimeline(state.health.data?.records ?? [], state.metrics.data?.records ?? []),
    [state.health.data, state.metrics.data],
  )

  // Expose the same shape as VehicleDataContext so user-side pages can be reused.
  const value = useMemo(
    () => ({
      vehicleId,
      vehicleIds: [vehicleId],
      setVehicleId: () => {},
      basePath: `/fleet/vehicles/${encodeURIComponent(vehicleId)}`,
      summary: state.summary,
      health: state.health,
      metrics: state.metrics,
      timeline,
      reload,
    }),
    [vehicleId, state, timeline, reload],
  )

  return <AdminVehicleDataContext.Provider value={value}>{children}</AdminVehicleDataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminVehicleData() {
  const ctx = useContext(AdminVehicleDataContext)
  if (!ctx) throw new Error('useAdminVehicleData must be used inside <AdminVehicleDataProvider>')
  return ctx
}
