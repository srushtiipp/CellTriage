import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpDown, Search } from 'lucide-react'
import Card from '../../components/ui/Card'
import Notice from '../../components/ui/Notice'
import PageHeader from '../../components/ui/PageHeader'
import RiskPill from '../../components/ui/RiskPill'
import Skeleton from '../../components/ui/Skeleton'
import { describeError } from '../../lib/apiClient'
import { DASH, fmtEfc, fmtInt, fmtSoh, fmtTemp, fmtVolt, toNum } from '../../lib/format'
import { riskInfo, RISK_ORDER } from '../../lib/risk'
import useFleetData from '../../hooks/useFleetData'

const RISK_RANK = { low: 0, medium: 1, high: 2, critical: 3, unknown: -1 }

function sortVehicles(list, { field, dir }) {
  return [...list].sort((a, b) => {
    let va, vb
    switch (field) {
      case 'id':
        va = String(a.vehicle_id ?? a.id ?? '')
        vb = String(b.vehicle_id ?? b.id ?? '')
        return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      case 'soh':
        va = toNum(a.latest_soh ?? a.soh) ?? -Infinity
        vb = toNum(b.latest_soh ?? b.soh) ?? -Infinity
        return dir === 'asc' ? va - vb : vb - va
      case 'risk':
        va = RISK_RANK[(a.risk_level ?? a.latest_risk_level ?? '').toLowerCase()] ?? -1
        vb = RISK_RANK[(b.risk_level ?? b.latest_risk_level ?? '').toLowerCase()] ?? -1
        return dir === 'asc' ? va - vb : vb - va
      case 'efc':
        va = toNum(a.latest_efc ?? a.efc) ?? -Infinity
        vb = toNum(b.latest_efc ?? b.efc) ?? -Infinity
        return dir === 'asc' ? va - vb : vb - va
      default:
        return 0
    }
  })
}

function SortButton({ field, current, dir, onSort, children }) {
  const active = current === field
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${active ? 'text-accent-strong' : 'text-text-muted hover:text-text-secondary'}`}
    >
      {children}
      <ArrowUpDown size={10} className={`${active ? 'opacity-100' : 'opacity-40'} ${active && dir === 'desc' ? 'rotate-180' : ''} transition-transform`} />
    </button>
  )
}

// Risk filter pills
const RISK_FILTERS = ['all', ...RISK_ORDER]

export default function FleetVehicles() {
  const { vehicles, reload } = useFleetData()
  const [query, setQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [sort, setSort] = useState({ field: 'risk', dir: 'desc' })

  const allVehicles = useMemo(() => {
    if (vehicles.status !== 'ready' || !vehicles.data) return []
    return Array.isArray(vehicles.data) ? vehicles.data : (vehicles.data.vehicles ?? [])
  }, [vehicles])

  const filtered = useMemo(() => {
    let list = allVehicles
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      const qNorm = q.replace(/o/g, '0')
      list = list.filter((v) => {
        const vid = String(v.vehicle_id ?? v.id ?? '').toLowerCase()
        return vid.includes(q) || vid.includes(qNorm)
      })
    }
    if (riskFilter !== 'all') {
      list = list.filter((v) => (v.risk_level ?? v.latest_risk_level ?? '').toLowerCase() === riskFilter)
    }
    return sortVehicles(list, sort)
  }, [allVehicles, query, riskFilter, sort])

  const handleSort = (field) => {
    setSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc',
    }))
  }

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="All Vehicles"
        subtitle={`${allVehicles.length > 0 ? `${allVehicles.length} vehicles` : 'Fleet'} — searchable, sortable list.`}
      />

      {vehicles.status === 'error' && (
        <Notice tone="bad" title="Could not load the vehicle list" onRetry={reload}>
          {describeError(vehicles.error, 'the vehicle list')}
        </Notice>
      )}

      <Card radius="cardLg" className="p-5">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1" style={{ minWidth: '12rem' }}>
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              id="fleet-search"
              type="search"
              placeholder="Search vehicle ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-app-border bg-app-surface py-1.5 pl-8 pr-3 text-[13px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {RISK_FILTERS.map((r) => {
              const info = riskInfo(r)
              const active = riskFilter === r
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRiskFilter(r)}
                  className={`hover-edge rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-accent-dim text-accent-strong'
                      : 'border border-app-border text-text-secondary hover:border-accent/40 hover:text-text-primary'
                  }`}
                >
                  {r === 'all' ? 'All' : info.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-md border border-app-border">
          {vehicles.status === 'loading' ? (
            <div className="space-y-2 p-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <table className="w-full min-w-max border-collapse text-[13px]">
              <caption className="sr-only">Fleet vehicle list</caption>
              <thead className="sticky top-0 z-[1] bg-app-surface2">
                <tr>
                  <th scope="col" className="px-3 py-2.5 text-left">
                    <SortButton field="id" current={sort.field} dir={sort.dir} onSort={handleSort}>Vehicle ID</SortButton>
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right">
                    <SortButton field="soh" current={sort.field} dir={sort.dir} onSort={handleSort}>Health index</SortButton>
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left">
                    <SortButton field="risk" current={sort.field} dir={sort.dir} onSort={handleSort}>Risk</SortButton>
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right">
                    <SortButton field="efc" current={sort.field} dir={sort.dir} onSort={handleSort}>EFC</SortButton>
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Voltage</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Temp</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Sessions</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[13px] text-text-muted">
                      {allVehicles.length === 0 ? 'No vehicles returned by the backend.' : 'No vehicles match your search.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((v) => {
                    const id = v.vehicle_id ?? v.id ?? DASH
                    const risk = v.risk_level ?? v.latest_risk_level ?? null
                    const soh = toNum(v.latest_soh ?? v.soh)
                    const efc = toNum(v.latest_efc ?? v.efc)
                    const voltage = toNum(v.latest_pack_voltage ?? v.pack_voltage)
                    const temp = toNum(v.latest_temperature ?? v.temperature)
                    const sessions = toNum(v.session_count ?? v.total_sessions)
                    return (
                      <tr
                        key={id}
                        className="border-t border-app-borderMuted hover:bg-app-surface2"
                      >
                        <td className="px-3 py-2.5">
                          <Link
                            to={`/fleet/vehicles/${encodeURIComponent(id)}`}
                            className="font-mono text-[13px] font-semibold text-text-primary hover:underline hover:text-accent-strong"
                          >
                            {id}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular text-text-primary">
                          {soh !== null ? (
                            <span className={soh < 70 ? 'text-status-bad' : soh < 85 ? 'text-status-warn' : ''}>
                              {fmtSoh(soh)}
                            </span>
                          ) : DASH}
                        </td>
                        <td className="px-3 py-2.5">
                          <RiskPill level={risk} />
                        </td>
                        <td className="px-3 py-2.5 text-right tabular text-text-secondary">{fmtEfc(efc)}</td>
                        <td className="px-3 py-2.5 text-right tabular text-text-secondary">{fmtVolt(voltage)}</td>
                        <td className="px-3 py-2.5 text-right tabular text-text-secondary">{fmtTemp(temp)}</td>
                        <td className="px-3 py-2.5 text-right tabular text-text-secondary">{fmtInt(sessions)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Link
                            to={`/fleet/vehicles/${encodeURIComponent(id)}`}
                            className="hover-edge inline-flex items-center gap-1 rounded-md border border-app-border bg-app-surface px-2 py-1 text-xs font-medium text-text-secondary hover:border-accent/40 hover:text-text-primary"
                            aria-label={`Inspect vehicle ${id}`}
                          >
                            Inspect <ArrowRight size={11} />
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > 0 && (
          <p className="mt-3 text-[11px] text-text-muted">
            Showing {filtered.length} of {allVehicles.length} vehicles.
            {riskFilter !== 'all' && ` Filtered to "${riskInfo(riskFilter).label}" only.`}
          </p>
        )}
      </Card>

      <Notice title="Health index colour coding">
        Health index values below 70% are highlighted red, 70–85% amber. These thresholds are a visual aid only —
        the backend's risk classification is the authoritative source of vehicle condition.
      </Notice>
    </div>
  )
}
