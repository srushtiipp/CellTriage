import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Gauge, Route, Thermometer, Zap, BatteryCharging } from 'lucide-react'
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
import { DASH, fmtAmp, fmtDate, fmtEfc, fmtInt, fmtKm, fmtSoc, fmtSoh, fmtTemp, fmtTempSpread, fmtVolt, fmtVoltSpread } from '../lib/format'
import { numbers, stats } from '../lib/sessions'

const METRICS = [
  { value: 'soc', label: 'SOC', yLabel: 'State of charge (%)', pick: (m) => m.soc, fmt: fmtSoc, tick: (v) => `${Math.round(v)}` },
  { value: 'pack_voltage', label: 'Pack voltage', yLabel: 'Pack voltage (V)', pick: (m) => m.pack_voltage, fmt: fmtVolt, tick: (v) => `${Math.round(v * 10) / 10}` },
  { value: 'current', label: 'Current', yLabel: 'Current (A)', pick: (m) => m.current, fmt: fmtAmp, tick: (v) => `${Math.round(v)}` },
  { value: 'temperature', label: 'Temperature', yLabel: 'Temperature (°C)', pick: (m) => m.temperature, fmt: fmtTemp, tick: (v) => `${Math.round(v * 10) / 10}` },
  { value: 'voltage_spread', label: 'Voltage spread', yLabel: 'Voltage spread (mV)', pick: (m) => (m.voltage_spread === null ? null : m.voltage_spread * 1000), fmt: (v) => (v === null ? DASH : `${Math.round(v)}\u00a0mV`), tick: (v) => `${Math.round(v)}` },
  { value: 'temperature_spread', label: 'Temp. spread', yLabel: 'Temperature spread (°C)', pick: (m) => m.temperature_spread, fmt: fmtTempSpread, tick: (v) => `${Math.round(v * 10) / 10}` },
]

const rowKey = (r) => r.key ?? `i${r.index}`

function Detail({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-app-borderMuted py-2 last:border-0">
      <dt className="text-[13px] text-text-secondary">{label}</dt>
      <dd className="text-[13px] font-semibold text-text-primary tabular">{value}</dd>
    </div>
  )
}

export default function Charging() {
  const { vehicleId, metrics, health, timeline, reload } = useVehicleData()
  const toPath = useVehiclePath()
  const rows = timeline.withMetrics
  const [metric, setMetric] = useState('soc')
  const [xMode, setXMode] = useState('efc')
  const [picked, setPicked] = useState(null)
  const [newestFirst, setNewestFirst] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const loading = metrics.status === 'loading'
  const def = METRICS.find((m) => m.value === metric)
  const efcOk = rows.length > 0 && rows.every((r) => r.efc !== null)
  const odoOk = rows.length > 0 && rows.every((r) => r.metrics.odometer !== null)
  const x = xMode === 'efc' && !efcOk ? (odoOk ? 'odometer' : 'session') : xMode === 'odometer' && !odoOk ? 'session' : xMode

  const xOf = (r, i) => (x === 'efc' ? r.efc : x === 'odometer' ? r.metrics.odometer : i + 1)
  const points = rows
    .map((r, i) => ({ x: xOf(r, i), y: def.pick(r.metrics), key: rowKey(r), row: r }))
    .filter((p) => p.x !== null && p.y !== null)

  const latest = rows.at(-1) ?? null
  const selectedRow = rows.find((r) => rowKey(r) === picked) ?? latest
  const selectedKey = selectedRow ? rowKey(selectedRow) : undefined
  const selectedX = selectedRow ? points.find((p) => p.key === selectedKey)?.x ?? null : null

  const med = (pick) => stats.median(numbers(rows, (r) => pick(r.metrics)))
  const hasTimestamps = rows.some((r) => r.metrics.timestamp)

  const tableRows = useMemo(() => {
    const ordered = newestFirst ? [...rows].reverse() : rows
    return showAll ? ordered : ordered.slice(0, 15)
  }, [rows, newestFirst, showAll])

  const columns = [
    { key: 's', label: 'Session', render: (r) => (r.session_id != null ? `#${r.session_id}` : DASH) },
    { key: 'e', label: 'EFC', align: 'right', render: (r) => fmtInt(r.efc) },
    { key: 'soc', label: 'SOC', align: 'right', render: (r) => fmtSoc(r.metrics.soc) },
    { key: 'v', label: 'Pack voltage', align: 'right', render: (r) => fmtVolt(r.metrics.pack_voltage) },
    { key: 'a', label: 'Current', align: 'right', render: (r) => fmtAmp(r.metrics.current) },
    { key: 't', label: 'Temp.', align: 'right', render: (r) => fmtTemp(r.metrics.temperature) },
    { key: 'vs', label: 'V spread', align: 'right', render: (r) => fmtVoltSpread(r.metrics.voltage_spread) },
    { key: 'ts', label: 'T spread', align: 'right', render: (r) => fmtTempSpread(r.metrics.temperature_spread) },
    { key: 'o', label: 'Odometer', align: 'right', render: (r) => fmtKm(r.metrics.odometer) },
    { key: 'h', label: 'Health index', align: 'right', render: (r) => (r.health ? fmtSoh(r.health.soh) : DASH) },
    ...(hasTimestamps ? [{ key: 'rec', label: 'Recorded', render: (r) => fmtDate(r.metrics.timestamp) }] : []),
  ]

  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="Charging" subtitle={`Session-level telemetry recorded for vehicle ${vehicleId}.`} />

      {metrics.status === 'error' && <Notice tone="bad" title="Telemetry unavailable" onRetry={reload}>{describeError(metrics.error, 'session telemetry')}</Notice>}
      {timeline.issues.metricsWithoutSession > 0 && (
        <Notice tone="warn" title="Some records have no session id">{timeline.issues.metricsWithoutSession} telemetry record(s) cannot be matched to a session, so they are not combined with health data.</Notice>
      )}
      {metrics.status === 'ready' && health.status === 'error' && (
        <Notice tone="warn" title="Health index unavailable">Telemetry is shown without each session’s health index. {describeError(health.error, 'health records')}</Notice>
      )}

      <Notice title="What this page shows">
        Each session has one telemetry record from the server. Charging duration, start and end state of charge, and the charging curve are not provided, so
        they are not shown. Current is displayed with the sign recorded by the vehicle; in the project’s source data, charging appears as negative current.
      </Notice>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricTile icon={BatteryCharging} label="Sessions recorded" value={fmtInt(rows.length)} loading={loading} error={metrics.status === 'error'} />
        <MetricTile icon={Route} label="Latest odometer" value={fmtKm(latest?.metrics.odometer)} loading={loading} error={metrics.status === 'error'} />
        <MetricTile icon={Zap} label="Typical SOC" value={fmtSoc(med((m) => m.soc))} hint="median across sessions" loading={loading} error={metrics.status === 'error'} />
        <MetricTile icon={Gauge} label="Typical pack voltage" value={fmtVolt(med((m) => m.pack_voltage))} hint="median across sessions" loading={loading} error={metrics.status === 'error'} />
        <MetricTile icon={Activity} label="Typical current" value={fmtAmp(med((m) => m.current))} hint="median, sign as recorded" loading={loading} error={metrics.status === 'error'} />
        <MetricTile icon={Thermometer} label="Typical temperature" value={fmtTemp(med((m) => m.temperature))} hint="median across sessions" loading={loading} error={metrics.status === 'error'} />
      </section>

      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <Card radius="cardLg" className="p-5 lg:col-span-8">
          <CardHeader
            title="Telemetry across sessions"
            subtitle="Click a point to inspect that session."
            action={
              <SegmentedControl
                label="Horizontal axis"
                value={x}
                onChange={setXMode}
                options={[
                  { value: 'efc', label: 'EFC' },
                  { value: 'odometer', label: 'Odometer' },
                  { value: 'session', label: 'Session order' },
                ]}
              />
            }
          />
          <div className="mb-3">
            <SegmentedControl label="Measurement" value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m.value, label: m.label }))} />
          </div>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : metrics.status === 'error' ? null : (
            <LineChart
              height={300}
              ariaLabel={`${def.label} across sessions`}
              series={[{ id: metric, label: def.label, color: 'accent', points }]}
              xLabel={x === 'efc' ? 'Equivalent full cycles (EFC)' : x === 'odometer' ? 'Odometer (km)' : 'Session order (oldest to newest)'}
              yLabel={def.yLabel}
              xFormat={(v) => Math.round(v).toLocaleString()}
              yFormat={def.tick}
              emptyText={`No ${def.label.toLowerCase()} values recorded.`}
              selectedX={selectedX}
              onSelect={(p) => setPicked(p.key)}
              renderTooltip={([{ point }]) => (
                <>
                  <p className="font-semibold text-text-primary">{point.row.session_id != null ? `Session #${point.row.session_id}` : 'Session'}</p>
                  <p className="mt-0.5 text-text-secondary tabular">
                    {def.label}: {def.fmt(point.y)}
                  </p>
                  <p className="text-text-secondary tabular">{fmtEfc(point.row.efc)}</p>
                </>
              )}
            />
          )}
        </Card>

        <Card radius="cardLg" className="p-5 lg:col-span-4">
          <CardHeader title="Selected session" subtitle={selectedRow ? (picked ? 'Chosen from the chart or table' : 'Latest session') : undefined} />
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : !selectedRow ? (
            <p className="text-[13px] text-text-muted">No sessions recorded yet.</p>
          ) : (
            <>
              <p className="mb-1 text-lg font-semibold text-text-primary">{selectedRow.session_id != null ? `Session #${selectedRow.session_id}` : 'Session'}</p>
              <dl>
                <Detail label="Cycles (EFC)" value={fmtEfc(selectedRow.efc)} />
                <Detail label="State of charge" value={fmtSoc(selectedRow.metrics.soc)} />
                <Detail label="Pack voltage" value={fmtVolt(selectedRow.metrics.pack_voltage)} />
                <Detail label="Current" value={fmtAmp(selectedRow.metrics.current)} />
                <Detail label="Temperature" value={fmtTemp(selectedRow.metrics.temperature)} />
                <Detail label="Voltage spread" value={fmtVoltSpread(selectedRow.metrics.voltage_spread)} />
                <Detail label="Temperature spread" value={fmtTempSpread(selectedRow.metrics.temperature_spread)} />
                <Detail label="Odometer" value={fmtKm(selectedRow.metrics.odometer)} />
                {selectedRow.metrics.timestamp && <Detail label="Recorded" value={fmtDate(selectedRow.metrics.timestamp)} />}
                <Detail label="Health index" value={selectedRow.health ? fmtSoh(selectedRow.health.soh) : DASH} />
                <Detail label="Risk" value={selectedRow.health ? <RiskPill level={selectedRow.health.risk_level} /> : DASH} />
              </dl>
              {!selectedRow.health && health.status === 'ready' && <p className="mt-3 text-xs text-text-muted">No health record exists for this session.</p>}
            </>
          )}
        </Card>
      </section>

      <Card radius="cardLg" className="p-5">
        <CardHeader
          title="Session telemetry"
          subtitle={rows.length ? `${rows.length} sessions` : undefined}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl label="Sort order" value={newestFirst ? 'new' : 'old'} onChange={(v) => setNewestFirst(v === 'new')} options={[{ value: 'new', label: 'Newest first' }, { value: 'old', label: 'Oldest first' }]} />
              {rows.length > 15 && (
                <button type="button" onClick={() => setShowAll((s) => !s)} className="hover-edge rounded-md border border-app-border px-2.5 py-1 text-xs font-medium text-text-primary hover:border-accent/40">
                  {showAll ? 'Show 15' : `Show all ${rows.length}`}
                </button>
              )}
            </div>
          }
        />
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <DataTable
            caption="Session telemetry"
            columns={columns}
            rows={tableRows}
            rowKey={rowKey}
            selectedKey={selectedKey}
            onRowClick={(r) => setPicked(rowKey(r))}
            maxHeight={showAll ? 460 : undefined}
            emptyText="No telemetry has been recorded for this vehicle yet."
          />
        )}
        <p className="mt-3 text-xs text-text-muted">
          Health index per session is on the <Link to={toPath('/battery-health')} className="font-medium text-accent-strong hover:underline">Battery Health</Link> page.
        </p>
      </Card>
    </div>
  )
}
