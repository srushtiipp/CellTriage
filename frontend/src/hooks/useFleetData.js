/**
 * useFleetData: fetches fleet-level data for the admin interface.
 * Each resource is fetched independently so one failure never blanks the others.
 * Returns { summary, vehicles, riskDist, sohOverview, reload }.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getFleetSummary, getFleetVehicles, getFleetRiskDistribution, getFleetSohOverview } from '../services/api'

const LOADING = { status: 'loading', data: null, error: null }

export default function useFleetData() {
  const [state, setState] = useState({
    summary: LOADING,
    vehicles: LOADING,
    riskDist: LOADING,
    sohOverview: LOADING,
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    setState({ summary: LOADING, vehicles: LOADING, riskDist: LOADING, sohOverview: LOADING })

    const run = async (name, fn) => {
      try {
        const data = await fn()
        if (!signal.aborted) setState((s) => ({ ...s, [name]: { status: 'ready', data, error: null } }))
      } catch (error) {
        if (signal.aborted || error?.kind === 'aborted') return
        setState((s) => ({ ...s, [name]: { status: 'error', data: null, error } }))
      }
    }

    run('summary', () => getFleetSummary(signal))
    run('vehicles', () => getFleetVehicles(signal))
    run('riskDist', () => getFleetRiskDistribution(signal))
    run('sohOverview', () => getFleetSohOverview(signal))

    return () => controller.abort()
  }, [tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])

  return useMemo(
    () => ({ ...state, reload }),
    [state, reload],
  )
}
