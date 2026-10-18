import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowRight, Gauge, Thermometer, Waves, Zap, Scale } from 'lucide-react'
import Card from '../components/ui/Card'
import CardHeader from '../components/ui/CardHeader'
import DataTable from '../components/ui/DataTable'
import LineChart from '../components/ui/LineChart'
import MetricTile from '../components/ui/MetricTile'
import Notice from '../components/ui/Notice'
import PageHeader from '../components/ui/PageHeader'
import RiskPill from '../components/ui/RiskPill'
import Skeleton from '../components/ui/Skeleton'
import TwinViewport from '../components/twin/TwinViewport'
import { useVehicleData, useVehiclePath } from '../context/VehicleDataContext'
import { describeError } from '../lib/apiClient'
import { DASH, fmtAh, fmtAmp, fmtEfc, fmtInt, fmtKm, fmtSigned, fmtSoc, fmtSoh, fmtTemp, fmtTempSpread, fmtVolt, fmtVoltSpread, toNum } from '../lib/format'
import { healthIndicators, REFERENCE_CAPACITY_AH } from '../lib/health'

function LinkAction({ to, children }) {
  return (
    <Link to={to} className="hover-edge inline-flex items-center gap-1 text-xs font-medium text-accent-strong hover:underline">
      {children} <ArrowRight size={12} aria-hidden="true" />
    </Link>
  )
}

export default function Overview() {
  const { vehicleId, summary, health, metrics, timeline, reload } = useVehicleData()
  const toPath = useVehiclePath()
  const s = summary.data
  const rows = timeline.withHealth
  const ind = useMemo(() => healthIndicators(rows), [rows])

  // The session that produced the latest summary: matched by EFC, never guessed.
  const latestSession = useMemo(() => {
    const efc = toNum(s?.latest_efc)
    if (efc === null) return null
    return rows.find((r) => r.health.efc === efc) ?? null
  }, [s, rows])

  const sumLoading = summary.status === 'loading'
  const sumError = summary.status === 'error'
  const soh = toNum(s?.latest_soh)

  const errors = [
    summary.status === 'error' && ['Latest summary', summary.error],
    health.status === 'error' && ['Health history', health.error],
    metrics.status === 'error' && ['Telemetry', metrics.error],
  ].filter(Boolean)

  const points = rows
    .filter((r) => r.health.soh !== null && r.efc !== null)
    .map((r) => ({ x: r.efc, y: r.health.soh, key: r.key ?? `i${r.index}`, row: r }))

  const recent = [...timeline.rows].filter((r) => r.health || r.metrics).reverse().slice(0, 8)
  const latestCapacity = ind?.hasCapacity ? ind.last.health.estimated_capacity_ah : null

  const stateRows = [
    ['Sessions recorded', health.status === 'ready' ? fmtInt(rows.length) : null, health.status],
    ['Cycles completed', fmtEfc(s?.latest_efc), summary.status],
    ['Odometer', fmtKm(s?.latest_odometer), summary.status],
    ['Change since first session', ind ? fmtSigned(ind.change, 1, 'pts') : null, health.status],
    ['Estimated capacity', latestCapacity !== null ? fmtAh(latestCapacity) : DASH, health.status],
  ]

  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="Command Center" subtitle={`Latest recorded state of vehicle ${vehicleId}.`} />

      {errors.length > 0 && (
        <Notice tone="bad" title="Some data could not be loaded" onRetry={reload}>
          <ul className="list-disc pl-4">
            {errors.map(([name, err]) => (
              <li key={name}>
                {name}: {describeError(err, name.toLowerCase())}
              </li>
            ))}
          </ul>
        </Notice>
      )}

      {/* Hero: status, twin, recorded state. All three stretch to one height. */}
      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <Card radius="cardLg" className="flex flex-col justify-between gap-6 p-5 lg:col-span-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Session-estimated health index</p>
            {sumLoading ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-12 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            ) : sumError ? (
              <p className="mt-4 text-[13px] text-status-bad">Latest status unavailable</p>
            ) : (
              <>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-5xl font-semibold leading-none text-text-primary tabular">{soh !== null ? soh.toFixed(1) : DASH}</span>
                  {soh !== null && <span className="text-xl text-text-secondary">%</span>}
                </div>
                <p className="mt-2 text-xs text-text-secondary">Relative to fixed {REFERENCE_CAPACITY_AH} Ah reference</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {s?.risk_level ? <RiskPill level={s.risk_level} /> : <span className="text-xs text-text-muted">Risk not rated</span>}
                  {soh !== null && soh > 100 && (
                    <span className="rounded-pill bg-app-surface2 px-2.5 py-1 text-xs font-medium text-text-secondary">Above {REFERENCE_CAPACITY_AH} Ah reference</span>
                  )}
                </div>
                <p className="mt-3 text-[11px] text-text-muted">
                  {latestSession?.session_id != null ? `Session #${latestSession.session_id} · ` : ''}
                  {fmtEfc(s?.latest_efc)}
                </p>
              </>
            )}
          </div>
          <div className="rounded-md border border-app-border bg-app-surface2 px-3 py-2.5 text-xs leading-relaxed text-text-secondary">
            Estimated against a fixed {REFERENCE_CAPACITY_AH} Ah reference.{' '}
            <Link to={toPath('/battery-health')} className="font-medium text-accent-strong hover:underline">
              Technical interpretation
            </Link>
          </div>
        </Card>

        <Card radius="cardLg" className="flex flex-col p-5 lg:col-span-6">
          <CardHeader title="Digital twin" subtitle="Pack-level state of charge (illustrative geometry)" action={<LinkAction to={toPath('/digital-twin')}>Open twin</LinkAction>} />
          <TwinViewport soc={toNum(s?.latest_soc)} compact className="min-h-[17rem] flex-1" />
        </Card>

        <Card radius="cardLg" className="flex flex-col p-5 lg:col-span-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Recorded battery state</p>
          <dl className="mt-3 flex flex-1 flex-col">
            {stateRows.map(([label, value, status]) => (
              <div key={label} className="flex flex-1 items-center justify-between gap-3 border-b border-app-borderMuted py-2 last:border-0">
                <dt className="text-[13px] text-text-secondary">{label}</dt>
                <dd className="text-[13px] font-semibold text-text-primary tabular">
                  {status === 'loading' ? <Skeleton className="h-3.5 w-14" /> : status === 'error' ? <span className="text-status-bad">Unavailable</span> : value ?? DASH}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>

      {/* Latest telemetry */}
      <section aria-label="Latest telemetry" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricTile icon={Zap} label="State of charge" value={fmtSoc(s?.latest_soc)} loading={sumLoading} error={sumError} />
        <MetricTile icon={Gauge} label="Pack voltage" value={fmtVolt(s?.latest_pack_voltage)} loading={sumLoading} error={sumError} />
        <MetricTile icon={Activity} label="Current" value={fmtAmp(s?.latest_current)} loading={sumLoading} error={sumError} />
        <MetricTile icon={Thermometer} label="Temperature" value={fmtTemp(s?.latest_temperature)} loading={sumLoading} error={sumError} />
        <MetricTile icon={Scale} label="Voltage spread" value={fmtVoltSpread(s?.latest_voltage_spread)} loading={sumLoading} error={sumError} hint="across cells" />
        <MetricTile icon={Waves} label="Temperature spread" value={fmtTempSpread(s?.latest_temperature_spread)} loading={sumLoading} error={sumError} hint="across sensors" />
      </section>

      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
        <Card radius="cardLg" className="flex flex-col p-5">
          <CardHeader title="Health progression" subtitle="Session-estimated health index vs. cycles (135 Ah reference)" action={<LinkAction to={toPath('/battery-health')}>Battery Health</LinkAction>} />
          <div className="min-h-[16rem] flex-1">
            {health.status === 'loading' ? (
              <Skeleton className="h-full min-h-[16rem] w-full" />
            ) : health.status === 'error' ? (
              <p className="text-[13px] text-text-muted">Health history unavailable.</p>
            ) : (
              <LineChart
                height="fill"
                ariaLabel="Session-estimated health index by equivalent full cycles"
                series={[{ id: 'soh', label: 'Health index', color: 'accent', points }]}
                xLabel="Equivalent full cycles (EFC)"
                yLabel="Session-estimated health index (%)"
                xFormat={(v) => Math.round(v).toLocaleString()}
                yFormat={(v) => `${Math.round(v * 10) / 10}`}
                referenceLines={[{ y: 100, label: `100% nominal reference (${REFERENCE_CAPACITY_AH} Ah)` }]}
                emptyText="No sessions with health and EFC yet."
                renderTooltip={([{ point }]) => (
                  <div className="space-y-1">
                    <p className="font-semibold text-text-primary">{point.row.session_id != null ? `Session #${point.row.session_id}` : 'Session'}</p>
                    <p className="text-text-secondary tabular"><span className="text-text-muted">Health index:</span> {fmtSoh(point.y)}</p>
                    <p className="text-text-secondary tabular"><span className="text-text-muted">Lifecycle:</span> {fmtEfc(point.x)}</p>
                    {point.row.health?.risk_level && <p className="text-text-secondary"><span className="text-text-muted">Risk rating:</span> {point.row.health.risk_level}</p>}
                  </div>
                )}
              />
            )}
          </div>
        </Card>

        <Card radius="cardLg" className="flex flex-col p-5">
          <CardHeader title="Recent sessions" subtitle="Newest first" action={<LinkAction to={toPath('/charging')}>All sessions</LinkAction>} />
          <div className="flex-1">
            {health.status === 'loading' && metrics.status === 'loading' ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <DataTable
                caption="Most recent recorded sessions"
                rowKey={(r) => r.key ?? `i${r.index}`}
                rows={recent}
                emptyText="No sessions have been recorded for this vehicle yet."
                columns={[
                  { key: 's', label: 'Session', render: (r) => (r.session_id != null ? `#${r.session_id}` : DASH) },
                  { key: 'e', label: 'EFC', align: 'right', render: (r) => fmtInt(r.efc) },
                  { key: 'h', label: 'Health index', align: 'right', render: (r) => fmtSoh(r.health?.soh) },
                  { key: 'r', label: 'Risk', render: (r) => (r.health ? <RiskPill level={r.health.risk_level} /> : DASH) },
                  { key: 'c', label: 'SOC', align: 'right', render: (r) => fmtSoc(r.metrics?.soc) },
                ]}
              />
            )}
          </div>
        </Card>
      </section>
    </div>
  )
}
