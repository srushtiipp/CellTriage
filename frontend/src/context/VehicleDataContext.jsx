/**
 * VehicleDataContext: loads the assigned vehicle's summary, health and metrics
 * once and shares them with every page. Each resource has its own status, so one
 * failing endpoint never blanks the others.
 *
 * useVehicleData() checks this context first, then AdminVehicleDataContext,
 * so user-side page components work in both user and admin routes.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AdminVehicleDataContext } from './AdminVehicleDataContext'
import { useAuth } from './AuthContext'
import { getHealthRecords, getMetricRecords, getSummary } from '../services/api'
import { buildTimeline } from '../lib/sessions'

const VehicleDataContext = createContext(null)
const STORAGE_KEY = 'celltriage-vehicle'
const LOADING = { status: 'loading', data: null, error: null }

function initialVehicle(ids) {
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY)
    if (saved && ids.includes(saved)) return saved
  } catch {
    /* storage unavailable */
  }
  return ids[0] ?? null
}

export function VehicleDataProvider({ children }) {
  const { vehicleIds } = useAuth()
  const [vehicleId, setVehicleIdState] = useState(() => initialVehicle(vehicleIds))
  const [state, setState] = useState({ summary: LOADING, health: LOADING, metrics: LOADING })
  const [tick, setTick] = useState(0)

  // Keep the selection valid if the assignment list changes.
  useEffect(() => {
    if (vehicleId && !vehicleIds.includes(vehicleId)) setVehicleIdState(initialVehicle(vehicleIds))
  }, [vehicleIds, vehicleId])

  const setVehicleId = useCallback(
    (id) => {
      if (!vehicleIds.includes(id)) return
      setVehicleIdState(id)
      try {
        window.sessionStorage.setItem(STORAGE_KEY, id)
      } catch {
        /* storage unavailable */
      }
    },
    [vehicleIds],
  )

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

  const value = useMemo(
    () => ({ vehicleId, vehicleIds, setVehicleId, basePath: '', summary: state.summary, health: state.health, metrics: state.metrics, timeline, reload }),
    [vehicleId, vehicleIds, setVehicleId, state, timeline, reload],
  )

  return <VehicleDataContext.Provider value={value}>{children}</VehicleDataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useVehicleData() {
  // Prefer the user-side context; fall back to the admin context when the page
  // is rendered under an admin vehicle-detail route.
  const userCtx = useContext(VehicleDataContext)
  const adminCtx = useContext(AdminVehicleDataContext)
  const ctx = userCtx ?? adminCtx
  if (!ctx) throw new Error('useVehicleData must be used inside <VehicleDataProvider> or <AdminVehicleDataProvider>')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export function useVehiclePath() {
  const { basePath = '' } = useVehicleData()
  return useCallback(
    (subpath) => {
      const clean = subpath.startsWith('/') ? subpath : `/${subpath}`
      return basePath ? `${basePath}${clean}` : clean
    },
    [basePath],
  )
}
