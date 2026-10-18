import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Car, HeartPulse, Shield } from 'lucide-react'
import Card from '../../components/ui/Card'
import CardHeader from '../../components/ui/CardHeader'
import LineChart from '../../components/ui/LineChart'
import MetricTile from '../../components/ui/MetricTile'
import Notice from '../../components/ui/Notice'
import PageHeader from '../../components/ui/PageHeader'
import RiskPill from '../../components/ui/RiskPill'
import Skeleton from '../../components/ui/Skeleton'
import { describeError } from '../../lib/apiClient'
import { DASH, fmtInt, fmtSoh, toNum } from '../../lib/format'
import { riskInfo, RISK_ORDER } from '../../lib/risk'
import useFleetData from '../../hooks/useFleetData'

function LinkAction({ to, children }) {
  return (
    <Link to={to} className="hover-edge inline-flex items-center gap-1 text-xs font-medium text-accent-strong hover:underline">
      {children} <ArrowRight size={12} aria-hidden="true" />
    </Link>
  )
}

/** Bar chart for risk distribution */
function RiskBar({ riskDist }) {
  if (riskDist.status === 'loading') return <Skeleton className="h-24 w-full" />
  if (riskDist.status === 'error') return <p className="text-[13px] text-text-muted">Risk distribution unavailable.</p>

  const data = riskDist.data
  // Accept both array [{risk_level, count}] and object {low:n, medium:n, ...}
  let counts = {}
  if (Array.isArray(data)) {
    data.forEach((item) => { counts[item.risk_level?.toLowerCase()] = item.count ?? 0 })
  } else if (data && typeof data === 'object') {
    counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k.toLowerCase(), v]))
  }

  const total = Object.values(counts).reduce((a, b) => a + Number(b || 0), 0)
  if (total === 0) return <p className="text-[13px] text-text-muted">No risk data available yet.</p>

  const BAR_COLORS = {
    low: 'bg-status-good',
    medium: 'bg-status-warn',
    high: 'bg-status-bad',
    critical: 'bg-status-bad',
    unknown: 'bg-text-muted/30',
  }

  const segments = [...RISK_ORDER, 'unknown']
    .map((key) => ({ key, count: Number(counts[key] || 0), info: riskInfo(key) }))
    .filter((s) => s.count > 0)

  return (
    <div className="space-y-3">
      <div className="flex h-6 w-full overflow-hidden rounded-pill">
        {segments.map((s) => (
          <div
            key={s.key}
            title={`${s.info.label}: ${s.count}`}
            className={`${BAR_COLORS[s.key] || 'bg-text-muted/30'} transition-all`}
            style={{ width: `${(s.count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${BAR_COLORS[s.key] || 'bg-text-muted/30'}`} />
            <span className="text-text-secondary">{s.info.label}</span>
            <span className="font-semibold text-text-primary tabular">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** SOH scatter for fleet overview */
function FleetSohChart({ sohOverview }) {
  const points = useMemo(() => {
    if (sohOverview.status !== 'ready' || !sohOverview.data) return []
    const items = Array.isArray(sohOverview.data) ? sohOverview.data : (sohOverview.data.vehicles ?? [])
    return items
      .filter((v) => toNum(v.latest_soh) !== null)
      .map((v, i) => ({
        x: i + 1,
        y: toNum(v.latest_soh),
        key: String(v.vehicle_id ?? i),
        vehicleId: v.vehicle_id,
      }))
  }, [sohOverview])

  if (sohOverview.status === 'loading') return <Skeleton className="h-full min-h-[14rem] w-full" />
  if (sohOverview.status === 'error') return <p className="text-[13px] text-text-muted">SOH overview unavailable.</p>

  return (
    <LineChart
      height="fill"
      ariaLabel="Health index for each fleet vehicle"
      series={[{ id: 'soh', label: 'Health index', color: 'accent', points }]}
      xLabel="Vehicle (ranked by position)"
      yLabel="Health index (%)"
      xFormat={(v) => `#${Math.round(v)}`}
      yFormat={(v) => `${Math.round(v * 10) / 10}`}
      referenceLines={[{ y: 100, label: '100 = reference' }]}
      emptyText="No health data available yet."
      renderTooltip={([{ point }]) => (
        <>
          <p className="font-semibold text-text-primary">Vehicle {point.vehicleId ?? point.key}</p>
          <p className="mt-0.5 text-text-secondary tabular">{fmtSoh(point.y)}</p>
        </>
      )}
    />
  )
}

export default function FleetOverview() {
  const { summary, vehicles, riskDist, sohOverview, reload } = useFleetData()

  const s = summary.data
  const vehicleList = useMemo(() => {
    if (vehicles.status !== 'ready' || !vehicles.data) return []
    return Array.isArray(vehicles.data) ? vehicles.data : (vehicles.data.vehicles ?? [])
  }, [vehicles])

  // Vehicles with high/critical risk — up to 5
  const attention = useMemo(() => {
    const HIGH_RISK = new Set(['high', 'critical'])
    return vehicleList
      .filter((v) => HIGH_RISK.has((v.risk_level ?? v.latest_risk_level ?? '').toLowerCase()))
      .slice(0, 5)
  }, [vehicleList])

  const sumLoading = summary.status === 'loading'
  const sumError = summary.status === 'error'

  const errors = [
    summary.status === 'error' && ['Fleet summary', summary.error],
    vehicles.status === 'error' && ['Vehicle list', vehicles.error],
    riskDist.status === 'error' && ['Risk distribution', riskDist.error],
    sohOverview.status === 'error' && ['SOH overview', sohOverview.error],
  ].filter(Boolean)

  // Extract fleet summary values — shapes vary; handle gracefully
  const totalVehicles = toNum(s?.total_vehicles ?? s?.vehicle_count) ?? (vehicles.status === 'ready' ? vehicleList.length : null)
  const avgSoh = toNum(s?.average_soh ?? s?.fleet_avg_soh ?? s?.avg_soh)
  const highRiskCount = toNum(s?.high_risk_count ?? s?.vehicles_high_risk)
  const activeVehicles = toNum(s?.active_vehicles ?? s?.vehicles_active)

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Fleet Overview"
        subtitle="Fleet-level health summary across all vehicles."
        actions={
          <Link
            to="/fleet/vehicles"
            className="hover-edge inline-flex items-center gap-1.5 rounded-md border border-app-border bg-app-surface px-3 py-1.5 text-[13px] font-medium text-text-primary hover:border-accent/40"
          >
            <Car size={14} /> All Vehicles
          </Link>
        }
      />

      {errors.length > 0 && (
        <Notice tone="warn" title="Some fleet data could not be loaded" onRetry={reload}>
          <ul className="list-disc pl-4">
            {errors.map(([name, err]) => (
              <li key={name}>
                {name}: {describeError(err, name.toLowerCase())}
              </li>
            ))}
          </ul>
        </Notice>
      )}

      {/* KPI tiles */}
      <section aria-label="Fleet key indicators" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricTile
          icon={Car}
          label="Total vehicles"
          value={fmtInt(totalVehicles)}
          loading={sumLoading && vehicles.status === 'loading'}
          error={sumError && vehicles.status === 'error'}
        />
        <MetricTile
          icon={HeartPulse}
          label="Fleet avg health index"
          value={fmtSoh(avgSoh)}
          hint="Session-estimated"
          loading={sumLoading}
          error={sumError}
        />
        <MetricTile
          icon={AlertTriangle}
          label="High/critical risk"
          value={fmtInt(highRiskCount)}
          loading={sumLoading}
          error={sumError}
        />
        <MetricTile
          icon={Shield}
          label="Active vehicles"
          value={fmtInt(activeVehicles)}
          loading={sumLoading}
          error={sumError}
        />
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Risk distribution */}
        <Card radius="cardLg" className="flex flex-col p-5 lg:col-span-4">
          <CardHeader
            title="Risk distribution"
            subtitle="Count of vehicles per risk level"
            action={<LinkAction to="/fleet/vehicles">Fleet table</LinkAction>}
          />
          <div className="mt-4 flex-1">
            <RiskBar riskDist={riskDist} />
          </div>
        </Card>

        {/* SOH overview chart */}
        <Card radius="cardLg" className="flex flex-col p-5 lg:col-span-8">
          <CardHeader
            title="Fleet health index"
            subtitle="Session-estimated SOH per vehicle (135 Ah reference)"
            action={<LinkAction to="/fleet/compare">Compare</LinkAction>}
          />
          <div className="min-h-[14rem] flex-1">
            <FleetSohChart sohOverview={sohOverview} />
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            Values above 100 indicate the vehicle's last recorded capacity exceeded the 135 Ah reference; they do not automatically indicate good health.
          </p>
        </Card>
      </section>

      {/* Vehicles needing attention */}
      {(vehicles.status === 'loading' || attention.length > 0) && (
        <Card radius="cardLg" className="p-5">
          <CardHeader
            title="Vehicles requiring attention"
            subtitle="High or critical risk — based on backend risk classification"
            action={<LinkAction to="/fleet/vehicles">All vehicles</LinkAction>}
          />
          {vehicles.status === 'loading' ? (
            <div className="mt-3 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="mt-3 divide-y divide-app-borderMuted">
              {attention.map((v) => {
                const id = v.vehicle_id ?? v.id ?? DASH
                const soh = toNum(v.latest_soh ?? v.soh)
                const risk = v.risk_level ?? v.latest_risk_level ?? null
                const efc = toNum(v.latest_efc ?? v.efc)
                return (
                  <div key={id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <RiskPill level={risk} />
                      <span className="font-mono text-[13px] font-semibold text-text-primary">{id}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="hidden text-[12px] text-text-secondary sm:block">
                        Health: <span className="font-semibold text-text-primary tabular">{fmtSoh(soh)}</span>
                      </span>
                      {efc !== null && (
                        <span className="hidden text-[12px] text-text-secondary lg:block">
                          EFC: <span className="font-semibold text-text-primary tabular">{fmtInt(efc)}</span>
                        </span>
                      )}
                      <Link
                        to={`/fleet/vehicles/${encodeURIComponent(id)}`}
                        className="hover-edge inline-flex items-center gap-1 rounded-md border border-app-border bg-app-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:border-accent/40"
                      >
                        Inspect <ArrowRight size={11} />
                      </Link>
                    </div>
                  </div>
                )
              })}
              {attention.length === 0 && vehicles.status === 'ready' && (
                <p className="py-4 text-center text-[13px] text-text-muted">No high or critical risk vehicles at this time.</p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Fleet stat detail */}
      {s && (
        <Card radius="cardLg" className="p-5">
          <CardHeader title="Fleet summary detail" subtitle="All values from the backend fleet summary endpoint" />
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 md:grid-cols-3">
            {Object.entries(s).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between border-b border-app-borderMuted py-2 last:border-0">
                <dt className="text-[12px] text-text-secondary">{key.replace(/_/g, ' ')}</dt>
                <dd className="text-[12px] font-semibold text-text-primary tabular">
                  {val === null || val === undefined ? DASH : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <Notice title="About the health index">
        The fleet health index is a session-estimated value derived from recorded charging session data, calibrated against a fixed 135 Ah reference capacity.
        Values above 100 indicate the vehicle's measured capacity exceeded the reference during that session; this does not automatically indicate exceptional health.
        The backend's risk classification is the definitive indicator of vehicle condition.
      </Notice>
    </div>
  )
}
