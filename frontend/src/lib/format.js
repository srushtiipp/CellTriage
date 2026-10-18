/**
 * format.js: display formatters. Calculations always use raw values; these are
 * for reading only. Missing values render as an em dash, never as 0.
 */
export const DASH = '\u2014'

/** Finite number or null. Accepts numeric strings. */
export function toNum(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

const num = (v, digits) => {
  const n = toNum(v)
  return n === null ? null : n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

const withUnit = (v, digits, unit) => {
  const s = num(v, digits)
  return s === null ? DASH : unit ? `${s}\u00a0${unit}` : s
}

export const fmtSoh = (v) => withUnit(v, 1, '%')
export const fmtEfc = (v) => withUnit(v, 0, 'EFC')
export const fmtEfcShort = (v) => withUnit(v, 0)
export const fmtSoc = (v) => withUnit(v, 0, '%')
export const fmtVolt = (v) => withUnit(v, 1, 'V')
export const fmtAmp = (v) => withUnit(v, 1, 'A')
export const fmtTemp = (v) => withUnit(v, 1, '\u00b0C')
export const fmtKm = (v) => withUnit(v, 0, 'km')
export const fmtAh = (v) => withUnit(v, 1, 'Ah')

/** voltage_spread is reported in volts; engineers read it in millivolts. */
export function fmtVoltSpread(v) {
  const n = toNum(v)
  return n === null ? DASH : `${(n * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}\u00a0mV`
}
export const fmtTempSpread = (v) => withUnit(v, 1, '\u00b0C')

/** Raw value as reported by the API; no unit is invented. */
export const fmtRaw = (v, digits = 3) => {
  const s = num(v, digits)
  return s === null ? DASH : s
}

export const fmtInt = (v) => {
  const n = toNum(v)
  return n === null ? DASH : Math.round(n).toLocaleString()
}

export function fmtSigned(v, digits = 1, unit = '') {
  const n = toNum(v)
  if (n === null) return DASH
  const s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${n < 0 ? '\u2212' : n > 0 ? '+' : ''}${s}${unit ? `\u00a0${unit}` : ''}`
}

/** Date only if the timestamp exists and parses into a plausible calendar date. Never invents a date. */
export function fmtDate(ts) {
  if (!ts) return DASH
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return DASH
  // Plausibility check: EV telemetry timestamps before the modern EV era (e.g. 1970s epoch offsets from raw uptime counters) are invalid conversions
  if (d.getFullYear() < 2000) return DASH
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
