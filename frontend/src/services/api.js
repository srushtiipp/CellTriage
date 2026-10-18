/**
 * api.js: typed wrappers for the backend endpoints this app uses.
 * See the API inventory for shapes. Every call goes through apiClient.
 */
import { apiRequest, fetchAllRecords } from '../lib/apiClient'

const enc = encodeURIComponent

export const getMe = (signal) => apiRequest('/api/auth/me', { signal })

export const getSummary = (vehicleId, signal) => apiRequest(`/api/vehicles/${enc(vehicleId)}/summary`, { signal })

export const getHealthRecords = (vehicleId, signal) => fetchAllRecords(`/api/vehicles/${enc(vehicleId)}/health`, { signal })

export const getMetricRecords = (vehicleId, signal) => fetchAllRecords(`/api/vehicles/${enc(vehicleId)}/metrics`, { signal })

/** POST /api/ai/copilot. A vehicle user always asks about their assigned vehicle. */
export const askCopilot = ({ message, vehicleId, runAnalysis = false }, signal) =>
  apiRequest('/api/ai/copilot', {
    method: 'POST',
    body: { message: message ?? null, vehicle_id: vehicleId ?? null, run_analysis: Boolean(runAnalysis) },
    timeoutMs: 60000,
    signal,
  })

// ── Fleet / Admin API ──────────────────────────────────────────────────────────

/** GET /api/fleet/summary — fleet-level KPIs */
export const getFleetSummary = (signal) => apiRequest('/api/fleet/summary', { signal })

/** GET /api/fleet/vehicles — list of all fleet vehicles with latest health */
export const getFleetVehicles = (signal) => apiRequest('/api/fleet/vehicles', { signal })

/** GET /api/fleet/risk-distribution — count of vehicles per risk level */
export const getFleetRiskDistribution = (signal) => apiRequest('/api/fleet/risk-distribution', { signal })

/** GET /api/fleet/soh-overview — latest SOH for every vehicle */
export const getFleetSohOverview = (signal) => apiRequest('/api/fleet/soh-overview', { signal })

/**
 * GET /api/fleet/compare?vehicle_ids=id1,id2,...
 * Compares up to 5 vehicles using a comma-separated list.
 */
export const getFleetCompare = (vehicleIds, signal) =>
  apiRequest(`/api/fleet/compare?vehicle_ids=${vehicleIds.map(enc).join(',')}`, { signal })

/** POST /api/fleet/ai — fleet-level AI copilot */
export const askFleetCopilot = ({ message, vehicleIds = null, runAnalysis = false }, signal) =>
  apiRequest('/api/fleet/ai', {
    method: 'POST',
    body: {
      message: message ?? null,
      vehicle_ids: Array.isArray(vehicleIds) && vehicleIds.length ? vehicleIds : null,
      run_analysis: Boolean(runAnalysis),
    },
    timeoutMs: 90000,
    signal,
  })
