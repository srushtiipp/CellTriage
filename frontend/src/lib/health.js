/** Derived, display-only facts about a health history. Nothing here is predicted. */
import { numbers, stats } from './sessions'
import { RISK_ORDER } from './risk'

export const REFERENCE_CAPACITY_AH = 135

export function healthIndicators(rows) {
  // rows: timeline rows that have `health`
  const sohRows = rows.filter((r) => r.health && r.health.soh !== null)
  if (!sohRows.length) return null
  const first = sohRows[0]
  const last = sohRows[sohRows.length - 1]
  const sohs = sohRows.map((r) => r.health.soh)
  const efcSpan = first.efc !== null && last.efc !== null ? last.efc - first.efc : null

  const riskCounts = { low: 0, medium: 0, high: 0, critical: 0, unknown: 0 }
  rows.forEach((r) => {
    const k = (r.health?.risk_level || '').toLowerCase()
    riskCounts[RISK_ORDER.includes(k) ? k : 'unknown'] += 1
  })

  return {
    count: sohRows.length,
    first,
    last,
    change: last.health.soh - first.health.soh,
    efcSpan,
    max: stats.max(sohs),
    min: stats.min(sohs),
    above100: sohs.filter((v) => v > 100).length,
    riskCounts,
    latestDegradation: numbers(rows, (r) => r.health?.degradation_rate).length ? last.health.degradation_rate : null,
    hasCapacity: rows.some((r) => r.health?.estimated_capacity_ah !== null && r.health?.estimated_capacity_ah !== undefined),
    hasTimestamps: rows.some((r) => r.health?.timestamp),
  }
}
