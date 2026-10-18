import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/ui/Card'
import CardHeader from '../components/ui/CardHeader'
import DataTable from '../components/ui/DataTable'
import LineChart from '../components/ui/LineChart'
import MetricTile from '../components/ui/MetricTile'
import Notice from '../components/ui/Notice'
import PageHeader from '../components/ui/PageHeader'
import RiskPill from '../components/ui/RiskPill'
import SegmentedControl from '../components/ui/SegmentedControl'
import Skeleton from '../components/ui/Skeleton'
import { useVehicleData, useVehiclePath } from '../context/VehicleDataContext'
import { describeError } from '../lib/apiClient'
import { DASH, fmtAh, fmtDate, fmtEfc, fmtInt, fmtRaw, fmtSigned, fmtSoh, toNum } from '../lib/format'
import { healthIndicators, REFERENCE_CAPACITY_AH } from '../lib/health'
import { RISK_LABELS, RISK_ORDER } from '../lib/risk'

const RISK_BAR = { low: 'bg-status-good', medium: 'bg-status-warn', high: 'bg-status-bad', critical: 'bg-status-bad', unknown: 'bg-text-muted' }

function RiskDistribution({ counts, total }) {
  const keys = [...RISK_ORDER, 'unknown'].filter((k) => counts[k] > 0)
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-pill bg-app-surface2" role="img" aria-label="Sessions by risk level">
        {keys.map((k) => (
          <div
            key={k}
            className={`${RISK_BAR[k]} ${k === 'critical' ? 'opacity-70' : ''}`}
            style={{ width: `${(counts[k] / total) * 100}%` }}
            title={`${RISK_LABELS[k]}: ${counts[k]}`}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {keys.map((k) => (
          <li key={k} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${RISK_BAR[k]}`} />
              {RISK_LABELS[k]}
            </span>
            <span className="font-medium text-text-primary tabular">{counts[k]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Methodology() {
  return (
    <Card radius="cardLg" className="h-full p-5">
      <CardHeader title="How the health index is estimated" subtitle="Technical interpretation guide" />
      <div className="space-y-3 text-[13px] leading-relaxed text-text-secondary">
        <p>
          The <strong className="font-semibold text-text-primary">session-estimated health index</strong> expresses the capacity estimated for one
          charging session as a percentage of a <strong className="font-semibold text-text-primary">fixed {REFERENCE_CAPACITY_AH} Ah reference capacity</strong>.
          Each point on the chart represents one charging session calculated via Coulomb counting relative to nominal capacity; it is a session estimate, not a laboratory capacity benchmark.
        </p>
        <p>
          <strong className="font-semibold text-text-primary">Values above 100% can occur:</strong> The 135 Ah reference is a fixed nominal specification rather than a factory baseline for this individual pack. Because new production packs may have positive manufacturing tolerances and session estimates can be affected by BMS state-of-charge drift or temperature variations, values above 100% are displayed as recorded. They should not be interpreted as exceptional condition or "better than new".
        </p>
        <p>
          <strong className="font-semibold text-text-primary">Abrupt transitions and low index values:</strong> On vehicle V001, a sharp decline from ~96.2% (session 941) to ~24.1% (session 950) is present in the underlying fleet records following a shift in charging current profiles. While this step-change is verified in the source dataset, its physical root cause (e.g. true rapid electrochemical degradation vs. BMS coulombic distortion during slow AC charging) has not been independently verified. It is not presented as proven physical battery failure.
        </p>
        <p>
          The risk rating shown beside each value is assigned by the CellTriage backend classification rules. This page does not model or forecast Remaining Useful Life (RUL).
        </p>
      </div>
    </Card>
  )
}

export default function BatteryHealth() {
  const { vehicleId, summary, health, timeline, reload } = useVehicleData()
  const toPath = useVehiclePath()
  const [xMode, setXMode] = useState('efc')
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState(null) // timeline row key

  const rows = timeline.withHealth
  const ind = useMemo(() => healthIndicators(rows), [rows])
  const loading = health.status === 'loading'
  const efcMissing = rows.some((r) => r.efc === null)
  const effectiveX = xMode === 'efc' && !efcMissing ? 'efc' : 'session'

  const points = rows
    .filter((r) => r.health.soh !== null)
    .map((r, i) => ({
      x: effectiveX === 'efc' ? r.efc : i + 1,
      y: r.health.soh,
      key: r.key ?? `i${r.index}`,
      row: r,
    }))
  const selectedRow = rows.find((r) => (r.key ?? `i${r.index}`) === selected) ?? null
  const selectedX = selectedRow ? points.find((p) => p.key === selected)?.x ?? null : null

  const sum = summary.data
  const latestSoh = sum?.latest_soh ?? ind?.last.health.soh ?? null
  const latestRisk = sum?.risk_level ?? ind?.last.health.risk_level ?? null
  const latestEfc = sum?.latest_efc ?? ind?.last.efc ?? null
  const latestDeg = sum ? toNum(sum.degradation_rate) : ind?.latestDegradation ?? null
  const latestCapacity = ind?.hasCapacity ? ind.last.health.estimated_capacity_ah : null

  const tableRows = useMemo(() => {
    const newestFirst = [...rows].reverse()
    return showAll ? newestFirst : newestFirst.slice(0, 12)
  }, [rows, showAll])

  const columns = [
    { key: 'session', label: 'Session', render: (r) => (r.session_id != null ? `#${r.session_id}` : DASH) },
    { key: 'efc', label: 'EFC', align: 'right', render: (r) => fmtInt(r.efc) },
    { key: 'soh', label: 'Health index', align: 'right', render: (r) => fmtSoh(r.health.soh) },
    { key: 'risk', label: 'Risk', render: (r) => <RiskPill level={r.health.risk_level} /> },
    { key: 'deg', label: 'Degradation rate', align: 'right', render: (r) => fmtRaw(r.health.degradation_rate, 4) },
    ...(ind?.hasCapacity ? [{ key: 'cap', label: 'Est. capacity', align: 'right', render: (r) => fmtAh(r.health.estimated_capacity_ah) }] : []),
    ...(ind?.hasTimestamps ? [{ key: 'ts', label: 'Recorded', render: (r) => fmtDate(r.health.timestamp) }] : []),
  ]

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Battery Health"
        subtitle={`Session-estimated health index for vehicle ${vehicleId}, relative to a fixed ${REFERENCE_CAPACITY_AH} Ah reference capacity.`}
      />

      {health.status === 'error' && <Notice tone="bad" title="Health history unavailable" onRetry={reload}>{describeError(health.error, 'health records')}</Notice>}
      {summary.status === 'error' && health.status !== 'error' && (
        <Notice tone="warn" title="Latest summary unavailable">Showing values from the session history instead. {describeError(summary.error, 'the summary')}</Notice>
      )}
      {timeline.issues.healthWithoutSession > 0 && (
        <Notice tone="warn" title="Some records have no session id">{timeline.issues.healthWithoutSession} health record(s) cannot be matched to a session. They are still listed.</Notice>
      )}

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card radius="cardLg" className="flex flex-col justify-between p-5 lg:col-span-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Session-estimated health index</p>
            {loading && summary.status === 'loading' ? (
              <Skeleton className="mt-4 h-14 w-32" />
            ) : (
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-[56px] font-semibold leading-none text-text-primary tabular">{latestSoh !== null ? toNum(latestSoh).toFixed(1) : DASH}</span>
                {latestSoh !== null && <span className="text-xl text-text-secondary">%</span>}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {latestRisk ? <RiskPill level={latestRisk} /> : null}
              {latestSoh !== null && latestSoh > 100 && (
                <span className="rounded-pill bg-app-surface2 px-2.5 py-1 text-xs font-medium text-text-secondary">Above {REFERENCE_CAPACITY_AH} Ah reference</span>
              )}
            </div>
            {latestSoh !== null && latestSoh > 100 && (
              <p className="mt-3 text-xs leading-relaxed text-text-muted">Values above 100% reflect recorded capacity exceeding the {REFERENCE_CAPACITY_AH} Ah nominal reference, not an "excellent" or better-than-new condition.</p>
            )}
          </div>
          <p className="mt-5 text-xs text-text-muted">Latest recorded · {fmtEfc(latestEfc)}</p>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:col-span-8 lg:grid-cols-3">
          <MetricTile label="Change since first session" loading={loading} error={health.status === 'error'}
            value={ind ? fmtSigned(ind.change, 1, 'pts') : null}
            hint={ind && ind.efcSpan !== null ? `over ${fmtInt(ind.efcSpan)} EFC` : undefined} />
          <MetricTile label="Highest recorded" loading={loading} error={health.status === 'error'} value={ind ? fmtSoh(ind.max) : null} />
          <MetricTile label="Lowest recorded" loading={loading} error={health.status === 'error'} value={ind ? fmtSoh(ind.min) : null} />
          <MetricTile label="Sessions above 100" loading={loading} error={health.status === 'error'}
            value={ind ? `${ind.above100} of ${ind.count}` : null} hint="estimate exceeds the reference" />
          <MetricTile label="Degradation rate" loading={summary.status === 'loading'} error={false}
            value={latestDeg !== null ? fmtRaw(latestDeg, 4) : null} hint="as reported, latest session" />
          <MetricTile label="Estimated capacity" loading={loading} error={false}
            value={latestCapacity !== null ? fmtAh(latestCapacity) : null}
            hint={latestCapacity !== null ? 'from the API, latest session' : 'not provided by the API'} />
        </div>
      </section>

      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <Card radius="cardLg" className="p-5 lg:col-span-8">
          <CardHeader
            title="Session-estimated health index progression"
            subtitle="Click a point to highlight its session in the table below."
            action={
              <SegmentedControl
                label="Horizontal axis"
                value={effectiveX}
                onChange={setXMode}
                options={[{ value: 'efc', label: 'By EFC' }, { value: 'session', label: 'By session order' }]}
              />
            }
          />
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : health.status === 'error' ? null : (
            <LineChart
              height={300}
              ariaLabel="Session-estimated health index over sessions"
              series={[{ id: 'soh', label: 'Health index', color: 'accent', points }]}
              xLabel={effectiveX === 'efc' ? 'Equivalent full cycles (EFC)' : 'Session order (oldest to newest)'}
              yLabel="Session-estimated health index (%)"
              xFormat={(v) => Math.round(v).toLocaleString()}
              yFormat={(v) => `${Math.round(v * 10) / 10}`}
              referenceLines={[{ y: 100, label: `100% nominal reference (${REFERENCE_CAPACITY_AH} Ah)` }]}
              selectedX={selectedX}
              onSelect={(p) => setSelected(p.key)}
              renderTooltip={([{ point }]) => (
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">{point.row.session_id != null ? `Session #${point.row.session_id}` : 'Session'}</p>
                  <p className="text-text-secondary tabular"><span className="text-text-muted">Health index:</span> {fmtSoh(point.y)}</p>
                  <p className="text-text-secondary tabular"><span className="text-text-muted">Lifecycle:</span> {fmtEfc(point.row.efc)}</p>
                  <p className="text-text-secondary"><span className="text-text-muted">Risk rating:</span> {point.row.health.risk_level ?? DASH}</p>
                </div>
              )}
            />
          )}
          {efcMissing && !loading && <p className="mt-2 text-xs text-text-muted">EFC is missing on some records, so sessions are shown in order.</p>}
        </Card>

        <Card radius="cardLg" className="p-5 lg:col-span-4">
          <CardHeader title="Sessions by risk rating" subtitle="Rating assigned by the backend" />
          {loading ? <Skeleton className="h-24 w-full" /> : ind ? <RiskDistribution counts={ind.riskCounts} total={rows.length} /> : (
            <p className="text-[13px] text-text-muted">No health records yet.</p>
          )}
        </Card>
      </section>

      <Card radius="cardLg" className="p-5">
        <CardHeader
          title="Session history"
          subtitle={rows.length ? `${rows.length} sessions · newest first` : undefined}
          action={rows.length > 12 ? (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="hover-edge rounded-md border border-app-border px-2.5 py-1 text-xs font-medium text-text-primary hover:border-accent/40">
              {showAll ? 'Show latest 12' : `Show all ${rows.length}`}
            </button>
          ) : null}
        />
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <DataTable
            caption="Session health history"
            columns={columns}
            rows={tableRows}
            rowKey={(r) => r.key ?? `i${r.index}`}
            selectedKey={selected ?? undefined}
            onRowClick={(r) => setSelected(r.key ?? `i${r.index}`)}
            maxHeight={showAll ? 420 : undefined}
            emptyText="No health records have been recorded for this vehicle yet."
          />
        )}
        <p className="mt-3 text-xs text-text-muted">
          Telemetry for these sessions is on the <Link to={toPath('/charging')} className="font-medium text-accent-strong hover:underline">Charging</Link> page.
        </p>
      </Card>

      <Methodology />
    </div>
  )
}
