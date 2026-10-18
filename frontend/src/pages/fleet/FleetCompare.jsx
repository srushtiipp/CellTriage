import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import Card from '../../components/ui/Card'
import CardHeader from '../../components/ui/CardHeader'
import LineChart from '../../components/ui/LineChart'
import Notice from '../../components/ui/Notice'
import PageHeader from '../../components/ui/PageHeader'
import RiskPill from '../../components/ui/RiskPill'
import Skeleton from '../../components/ui/Skeleton'
import { ApiError, describeError } from '../../lib/apiClient'
import { fmtEfc, fmtInt, fmtSoh, fmtTemp, fmtVolt, toNum } from '../../lib/format'
import { getFleetCompare, getFleetVehicles } from '../../services/api'

const MAX_VEHICLES = 5

// High-contrast, distinguishable palette across light & dark modes:
// Emerald, Sky Blue, Amber, Purple, Rose
const SERIES_HEX_COLORS = [
  '#10b981',
  '#0ea5e9',
  '#f59e0b',
  '#a855f7',
  '#f43f5e',
]
const SERIES_COLORS = SERIES_HEX_COLORS

function useAllVehicleIds() {
  const [ids, setIds] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    getFleetVehicles(controller.signal)
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.vehicles ?? [])
        setIds(list.map((v) => String(v.vehicle_id ?? v.id ?? '')).filter(Boolean))
        setLoading(false)
      })
      .catch(() => setLoading(false))
    return () => controller.abort()
  }, [])
  return { ids, loading }
}

function normalizeVid(id) {
  const clean = String(id || '').trim()
  if (/^v[0-9o]{1,3}$/i.test(clean)) {
    return 'V' + clean.slice(1).toUpperCase().replace(/O/g, '0').padStart(3, '0')
  }
  return clean
}

function VehicleSelector({ selected, all, onAdd, onRemove, loading }) {
  const [input, setInput] = useState('')
  const normInput = input.toUpperCase().replace(/O/g, '0')
  const suggestions = all.filter(
    (id) => !selected.includes(id) && (id.toLowerCase().includes(input.toLowerCase()) || id.includes(normInput))
  )

  const add = (id) => {
    const clean = normalizeVid(id)
    if (!clean || selected.includes(clean) || selected.length >= MAX_VEHICLES) return
    onAdd(clean)
    setInput('')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {selected.map((id, i) => (
          <span
            key={id}
            className="inline-flex items-center gap-1.5 rounded-pill border border-app-border bg-app-surface py-0.5 pl-3 pr-1.5 text-[13px] font-mono font-semibold"
            style={{ borderColor: `${SERIES_HEX_COLORS[i]}55`, color: SERIES_HEX_COLORS[i] }}
          >
            {id}
            <button type="button" onClick={() => onRemove(id)} className="rounded-full p-0.5 hover:bg-app-surface2" aria-label={`Remove ${id}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        {selected.length < MAX_VEHICLES && (
          <span className="text-[12px] text-text-muted">(up to {MAX_VEHICLES} vehicles)</span>
        )}
      </div>

      {selected.length < MAX_VEHICLES && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter vehicle ID…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
            className="flex-1 rounded-md border border-app-border bg-app-surface px-3 py-1.5 text-[13px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            style={{ maxWidth: '18rem' }}
          />
          <button
            type="button"
            onClick={() => add(input)}
            disabled={!input.trim() || selected.length >= MAX_VEHICLES}
            className="hover-edge inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent-dim px-3 py-1.5 text-[13px] font-medium text-accent-strong disabled:opacity-50"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      )}

      {!loading && suggestions.length > 0 && input.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 10).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => add(id)}
              className="hover-edge rounded-md border border-app-border bg-app-surface px-2 py-0.5 font-mono text-[12px] text-text-secondary hover:border-accent/40"
            >
              {id}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FleetCompare() {
  const [searchParams] = useSearchParams()
  const initialIds = useMemo(() => {
    const raw = searchParams.get('ids') ?? ''
    return raw.split(',').map(normalizeVid).filter(Boolean).slice(0, MAX_VEHICLES)
  }, [searchParams])

  const [selected, setSelected] = useState(initialIds)
  const [compareData, setCompareData] = useState({ status: 'idle', data: null, error: null })
  const { ids: allIds, loading: loadingIds } = useAllVehicleIds()

  const addVehicle = useCallback((id) => setSelected((prev) => (prev.includes(id) || prev.length >= MAX_VEHICLES ? prev : [...prev, id])), [])
  const removeVehicle = useCallback((id) => setSelected((prev) => prev.filter((x) => x !== id)), [])

  useEffect(() => {
    if (selected.length < 1) {
      setCompareData({ status: 'idle', data: null, error: null })
      return undefined
    }
    const controller = new AbortController()
    setCompareData({ status: 'loading', data: null, error: null })
    getFleetCompare(selected, controller.signal)
      .then((data) => setCompareData({ status: 'ready', data, error: null }))
      .catch((err) => {
        if (err?.kind === 'aborted') return
        setCompareData({ status: 'error', data: null, error: err })
      })
    return () => controller.abort()
  }, [selected])

  // Build SOH-over-EFC series for each vehicle from the compare response
  const sohSeries = useMemo(() => {
    if (compareData.status !== 'ready' || !compareData.data) return []
    const vehicles = Array.isArray(compareData.data) ? compareData.data : (compareData.data.vehicles ?? [])
    return vehicles.map((v, i) => {
      const id = String(v.vehicle_id ?? v.id ?? `V${i + 1}`)
      const history = Array.isArray(v.health_history) ? v.health_history : []
      const points = history
        .filter((r) => toNum(r.efc) !== null && toNum(r.soh) !== null)
        .map((r) => ({ x: toNum(r.efc), y: toNum(r.soh), key: `${id}-${r.session_id ?? r.efc}` }))
      return {
        id,
        label: id,
        color: SERIES_COLORS[i] || 'muted',
        points,
      }
    })
  }, [compareData])

  // Summary comparison table rows
  const summaryRows = useMemo(() => {
    if (compareData.status !== 'ready' || !compareData.data) return []
    const vehicles = Array.isArray(compareData.data) ? compareData.data : (compareData.data.vehicles ?? [])
    return vehicles.map((v, i) => ({
      id: String(v.vehicle_id ?? v.id ?? `V${i + 1}`),
      colorIdx: i,
      soh: toNum(v.latest_soh ?? v.summary?.latest_soh),
      risk: v.risk_level ?? v.latest_risk_level ?? v.summary?.risk_level ?? null,
      efc: toNum(v.latest_efc ?? v.summary?.latest_efc),
      voltage: toNum(v.latest_pack_voltage ?? v.summary?.latest_pack_voltage),
      temp: toNum(v.latest_temperature ?? v.summary?.latest_temperature),
      sessions: toNum(v.session_count ?? v.summary?.session_count),
    }))
  }, [compareData])

  const chartHasSeries = sohSeries.some((s) => s.points.length > 0)

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Compare Vehicles"
        subtitle="Select up to 5 vehicles to compare their health index progression and latest indicators."
      />

      {/* Vehicle selector */}
      <Card radius="cardLg" className="p-5">
        <CardHeader title="Vehicle selection" subtitle="Compare up to 5 vehicles side-by-side" />
        <div className="mt-4">
          <VehicleSelector
            selected={selected}
            all={allIds}
            onAdd={addVehicle}
            onRemove={removeVehicle}
            loading={loadingIds}
          />
        </div>
      </Card>

      {/* Errors */}
      {compareData.status === 'error' && (
        <Notice tone="bad" title="Comparison could not be loaded">
          {compareData.error instanceof ApiError && (compareData.error.status === 501 || compareData.error.status === 503)
            ? 'The comparison endpoint is not available on this server.'
            : describeError(compareData.error, 'the comparison')}
        </Notice>
      )}

      {/* State when nothing selected */}
      {selected.length === 0 && (
        <Notice title="No vehicles selected">
          Add at least one vehicle ID above to begin a comparison.
        </Notice>
      )}

      {/* Loading */}
      {compareData.status === 'loading' && (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {/* SOH chart */}
      {compareData.status === 'ready' && (
        <>
          <Card radius="cardLg" className="flex flex-col p-5">
            <CardHeader
              title="Health index progression"
              subtitle="Session-estimated health index vs. equivalent full cycles per vehicle"
            />
            {chartHasSeries ? (
              <div className="min-h-[18rem] flex-1">
                <LineChart
                  height="fill"
                  showLegend
                  ariaLabel="Health index progression comparison"
                  series={sohSeries}
                  xLabel="Equivalent full cycles (EFC)"
                  yLabel="Health index (%)"
                  xFormat={(v) => Math.round(v).toLocaleString()}
                  yFormat={(v) => `${Math.round(v * 10) / 10}`}
                  referenceLines={[{ y: 100, label: '100 = reference' }]}
                  emptyText="No health history available for selected vehicles."
                  renderTooltip={(items) => (
                    <div className="space-y-1">
                      <p className="font-semibold text-text-primary tabular">{Math.round(items[0]?.point?.x ?? 0).toLocaleString()} EFC</p>
                      {items.map(({ series, point }) => (
                        <div key={series.id} className="flex items-center gap-1.5 text-xs text-text-secondary tabular">
                          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: series.color }} />
                          <span className="font-medium text-text-primary">{series.label}:</span>
                          <span>{point && toNum(point.y) !== null ? fmtSoh(point.y) : '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                />
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-text-muted">
                No health history data returned for the selected vehicles. The comparison endpoint may not include session-level history, or the vehicles have no recorded sessions.
              </p>
            )}
            <Notice tone="info" className="mt-3">
              Histories represent separate sequences of sessions for each vehicle. EFC values are not calendar-aligned; do not interpret identical EFC values as the same point in time.
            </Notice>
          </Card>

          {/* Summary comparison table */}
          {summaryRows.length > 0 && (
            <Card radius="cardLg" className="p-5">
              <CardHeader title="Latest indicators" subtitle="Most recent recorded values per vehicle" />
              <div className="mt-3 overflow-x-auto rounded-md border border-app-border">
                <table className="w-full min-w-max border-collapse text-[13px]">
                  <caption className="sr-only">Vehicle comparison summary</caption>
                  <thead className="bg-app-surface2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2.5 text-left">Vehicle</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Health index</th>
                      <th scope="col" className="px-3 py-2.5 text-left">Risk</th>
                      <th scope="col" className="px-3 py-2.5 text-right">EFC</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Voltage</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Temp</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((row) => (
                      <tr key={row.id} className="border-t border-app-borderMuted hover:bg-app-surface2">
                        <td className="px-3 py-2.5">
                          <span
                            className="font-mono text-[13px] font-semibold"
                            style={{ color: SERIES_HEX_COLORS[row.colorIdx] }}
                          >
                            {row.id}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular text-text-primary">{fmtSoh(row.soh)}</td>
                        <td className="px-3 py-2.5"><RiskPill level={row.risk} /></td>
                        <td className="px-3 py-2.5 text-right tabular text-text-secondary">{fmtEfc(row.efc)}</td>
                        <td className="px-3 py-2.5 text-right tabular text-text-secondary">{fmtVolt(row.voltage)}</td>
                        <td className="px-3 py-2.5 text-right tabular text-text-secondary">{fmtTemp(row.temp)}</td>
                        <td className="px-3 py-2.5 text-right tabular text-text-secondary">{fmtInt(row.sessions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-text-muted">
                Health index calibrated against a fixed 135 Ah reference capacity. Values above 100 indicate the recorded capacity exceeded the reference during that session.
              </p>
            </Card>
          )}

          {/* If API returned something but we couldn't parse a vehicles array */}
          {summaryRows.length === 0 && !chartHasSeries && compareData.data && (
            <Card radius="cardLg" className="p-5">
              <CardHeader title="Raw comparison response" subtitle="The API response was received but no vehicle data was recognised" />
              <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-app-surface2 p-3 text-[11px] text-text-secondary">
                {JSON.stringify(compareData.data, null, 2)}
              </pre>
            </Card>
          )}
        </>
      )}

      <Notice title="Comparison basis">
        Comparison uses per-vehicle session sequences. Each vehicle's EFC axis begins from its first recorded session.
        Vehicles may have been manufactured or placed in service at different times, and their session sequences are independent.
      </Notice>
    </div>
  )
}
