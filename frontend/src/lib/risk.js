/**
 * risk.js: maps the backend's `risk_level` string to a display level.
 * The backend decides the risk; the frontend never recomputes it from SOH.
 */
const LEVELS = {
  low: { key: 'low', label: 'Low risk', tone: 'good', rank: 0 },
  medium: { key: 'medium', label: 'Medium risk', tone: 'warn', rank: 1 },
  high: { key: 'high', label: 'High risk', tone: 'bad', rank: 2 },
  critical: { key: 'critical', label: 'Critical risk', tone: 'bad', rank: 3 },
}
const UNKNOWN = { key: 'unknown', label: 'Not rated', tone: 'neutral', rank: -1 }

export function riskInfo(level) {
  if (typeof level !== 'string') return UNKNOWN
  return LEVELS[level.trim().toLowerCase()] || UNKNOWN
}

export const RISK_ORDER = ['low', 'medium', 'high', 'critical']
export const RISK_LABELS = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical', unknown: 'Not rated' }
