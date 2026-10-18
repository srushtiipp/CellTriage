/**
 * sessions.js: combines health and metrics records into one per-session timeline.
 *
 * Records are matched ONLY by (vehicle_id, session_id). Array position and
 * timestamps are never used, so a missing or reordered record can not shift data
 * onto the wrong session. Records without a session_id stay unmatched and are
 * reported through `issues`.
 */
import { toNum } from './format'

const keyOf = (r) => (r && r.session_id != null ? `${r.vehicle_id ?? ''}|${r.session_id}` : null)

function cleanHealth(r) {
  return {
    ...r,
    session_id: r.session_id ?? null,
    soh: toNum(r.soh),
    efc: toNum(r.efc),
    degradation_rate: toNum(r.degradation_rate),
    estimated_capacity_ah: toNum(r.estimated_capacity_ah),
    risk_level: typeof r.risk_level === 'string' ? r.risk_level : null,
  }
}

function cleanMetrics(r) {
  return {
    ...r,
    session_id: r.session_id ?? null,
    efc: toNum(r.efc),
    soc: toNum(r.soc),
    pack_voltage: toNum(r.pack_voltage),
    current: toNum(r.current),
    temperature: toNum(r.temperature),
    voltage_spread: toNum(r.voltage_spread),
    temperature_spread: toNum(r.temperature_spread),
    odometer: toNum(r.odometer),
  }
}

const sessionNumber = (s) => {
  const n = toNum(s.session_id)
  return n === null ? Number.POSITIVE_INFINITY : n
}

export function buildTimeline(healthRecords = [], metricRecords = []) {
  const health = healthRecords.map(cleanHealth)
  const metrics = metricRecords.map(cleanMetrics)

  const bySession = new Map()
  const loose = []
  const issues = { healthWithoutSession: 0, metricsWithoutSession: 0, duplicateKeys: 0 }

  const slot = (r, side) => {
    const key = keyOf(r)
    if (key === null) {
      issues[side === 'health' ? 'healthWithoutSession' : 'metricsWithoutSession'] += 1
      const entry = { key: null, session_id: null, health: null, metrics: null }
      entry[side] = r
      loose.push(entry)
      return
    }
    let entry = bySession.get(key)
    if (!entry) {
      entry = { key, session_id: r.session_id, health: null, metrics: null }
      bySession.set(key, entry)
    }
    if (entry[side]) issues.duplicateKeys += 1
    entry[side] = r
  }

  health.forEach((r) => slot(r, 'health'))
  metrics.forEach((r) => slot(r, 'metrics'))

  const rows = [...bySession.values(), ...loose].map((e) => ({
    ...e,
    efc: e.health?.efc ?? e.metrics?.efc ?? null,
  }))

  rows.sort((a, b) => {
    const ae = a.efc
    const be = b.efc
    if (ae !== null && be !== null && ae !== be) return ae - be
    if (ae === null && be !== null) return 1
    if (ae !== null && be === null) return -1
    return sessionNumber(a) - sessionNumber(b)
  })

  rows.forEach((r, i) => {
    r.index = i
  })

  return {
    rows,
    withHealth: rows.filter((r) => r.health),
    withMetrics: rows.filter((r) => r.metrics),
    issues,
    hasIssues: issues.healthWithoutSession + issues.metricsWithoutSession + issues.duplicateKeys > 0,
  }
}

export const stats = {
  min: (xs) => (xs.length ? Math.min(...xs) : null),
  max: (xs) => (xs.length ? Math.max(...xs) : null),
  mean: (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null),
  median: (xs) => {
    if (!xs.length) return null
    const s = [...xs].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  },
}

/** Values of `pick(row)` that are finite numbers. */
export const numbers = (rows, pick) => rows.map(pick).filter((v) => typeof v === 'number' && Number.isFinite(v))
