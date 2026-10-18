import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import Card from '../components/ui/Card'
import CardHeader from '../components/ui/CardHeader'
import LineChart from '../components/ui/LineChart'
import Notice from '../components/ui/Notice'
import PageHeader from '../components/ui/PageHeader'
import RiskPill from '../components/ui/RiskPill'
import SegmentedControl from '../components/ui/SegmentedControl'
import Skeleton from '../components/ui/Skeleton'
import TwinViewport from '../components/twin/TwinViewport'
import { useVehicleData } from '../context/VehicleDataContext'
import { describeError } from '../lib/apiClient'
import { DASH, fmtAmp, fmtEfc, fmtKm, fmtSoc, fmtSoh, fmtTemp, fmtTempSpread, fmtVolt, fmtVoltSpread } from '../lib/format'

const CHARTS = [
  { value: 'soh', label: 'Health index', yLabel: 'Health index (%)', pick: (r) => r.health?.soh ?? null, fmt: fmtSoh, tick: (v) => `${Math.round(v * 10) / 10}` },
  { value: 'soc', label: 'SOC', yLabel: 'State of charge (%)', pick: (r) => r.metrics?.soc ?? null, fmt: fmtSoc, tick: (v) => `${Math.round(v)}` },
  { value: 'vs', label: 'Voltage spread', yLabel: 'Voltage spread (mV)', pick: (r) => (r.metrics?.voltage_spread == null ? null : r.metrics.voltage_spread * 1000), fmt: (v) => `${Math.round(v)}\u00a0mV`, tick: (v) => `${Math.round(v)}` },
  { value: 'ts', label: 'Temp. spread', yLabel: 'Temperature spread (°C)', pick: (r) => r.metrics?.temperature_spread ?? null, fmt: fmtTempSpread, tick: (v) => `${Math.round(v * 10) / 10}` },
]

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-app-borderMuted py-2 last:border-0">
      <dt className="text-[13px] text-text-secondary">{label}</dt>
      <dd className="text-[13px] font-semibold text-text-primary tabular">{value}</dd>
    </div>
  )
}

export default function DigitalTwin() {
  const { vehicleId, health, metrics, timeline, reload } = useVehicleData()
  const rows = useMemo(() => timeline.rows.filter((r) => r.health || r.metrics), [timeline])
  const [index, setIndex] = useState(null) // null = latest
  const [playing, setPlaying] = useState(false)
  const [chart, setChart] = useState('soh')

  const last = rows.length - 1
  const i = index === null ? last : Math.min(index, last)
  const row = rows[i] ?? null
  const def = CHARTS.find((c) => c.value === chart)
  const loading = health.status === 'loading' && metrics.status === 'loading'
  const bothFailed = health.status === 'error' && metrics.status === 'error'

  // Reset scrubber when switching vehicles
  useEffect(() => {
    setIndex(null)
    setPlaying(false)
  }, [vehicleId])

  // Play steps through sessions, then stops on the latest one.
  useEffect(() => {
    if (!playing) return undefined
    const id = setInterval(() => {
      setIndex((cur) => {
        const next = (cur === null ? last : cur) + 1
        if (next >= last) {
          setPlaying(false)
          return last
        }
        return next
      })
    }, 450)
    return () => clearInterval(id)
  }, [playing, last])

  const togglePlay = () => {
    if (!playing && i >= last) setIndex(0)
    setPlaying((p) => !p)
  }
  const step = (d) => {
    setPlaying(false)
    setIndex(Math.max(0, Math.min(last, i + d)))
  }

  const points = rows
    .map((r, k) => ({ x: r.efc ?? null, y: def.pick(r), k, row: r }))
    .filter((p) => p.x !== null && p.y !== null)
  const selectedX = row && row.efc !== null ? row.efc : null

  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="Digital Twin" subtitle={`A pack-level view of vehicle ${vehicleId} at each recorded session.`} />

      {health.status === 'error' && !bothFailed && <Notice tone="warn" title="Health data unavailable" onRetry={reload}>{describeError(health.error, 'health records')}</Notice>}
      {metrics.status === 'error' && !bothFailed && <Notice tone="warn" title="Telemetry unavailable" onRetry={reload}>{describeError(metrics.error, 'session telemetry')}</Notice>}
      {bothFailed && <Notice tone="bad" title="Session data unavailable" onRetry={reload}>{describeError(metrics.error, 'session data')}</Notice>}

      <Notice title="Digital Twin scope & illustrative geometry">
        <p className="mb-1.5">
          <strong>Illustrative 12-block layout:</strong> The 3D view renders an illustrative pack geometry updated by session-level telemetry. The fleet API reports pack-level aggregates (SOC, voltage, temperature, spreads); raw individual cell sensor telemetry is not part of the fleet dataset and is not simulated here.
        </p>
        <p>
          <strong>State of Charge (SOC) fill level:</strong> The fill height inside each module represents the <em>recorded pack State of Charge (SOC: {row?.metrics?.soc != null ? `${Math.round(row.metrics.soc)}%` : 'No data'})</em> for this session. The fill color is a visual rendering style; it does <strong>not</strong> indicate cell degradation, thermal hotspots, or fault severity. Moving the scrubber steps through this vehicle's recorded session history.
        </p>
      </Notice>

      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <Card radius="cardLg" className="flex flex-col p-5 lg:col-span-8">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <span className="rounded border border-accent/40 bg-accent-dim px-2 py-0.5 font-mono text-xs font-semibold text-accent-strong">
                  {vehicleId}
                </span>
                <span>{row ? (row.session_id != null ? `Session #${row.session_id}` : 'Selected session') : 'Pack view'}</span>
              </div>
            }
            subtitle={row ? `${fmtEfc(row.efc)} · session ${i + 1} of ${rows.length} · Pack SOC: ${row.metrics?.soc != null ? `${Math.round(row.metrics.soc)}%` : 'No SOC data'}` : undefined}
          />
          {loading ? (
            <Skeleton className="min-h-[24rem] flex-1" />
          ) : (
            <TwinViewport soc={row?.metrics?.soc ?? null} vehicleId={vehicleId} className="min-h-[24rem] flex-1" />
          )}

          <div className="mt-4 flex items-center gap-3" role="group" aria-label="Session scrubber">
            <button type="button" onClick={() => step(-1)} disabled={!row || i <= 0} aria-label="Previous session" className="hover-edge rounded-md border border-app-border bg-app-surface p-2 text-text-secondary hover:text-text-primary disabled:opacity-40">
              <SkipBack size={15} />
            </button>
            <button type="button" onClick={togglePlay} disabled={rows.length < 2} aria-label={playing ? 'Pause' : 'Play through sessions'} className="hover-edge rounded-md border border-accent/40 bg-accent-dim p-2 text-accent-strong disabled:opacity-40">
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button type="button" onClick={() => step(1)} disabled={!row || i >= last} aria-label="Next session" className="hover-edge rounded-md border border-app-border bg-app-surface p-2 text-text-secondary hover:text-text-primary disabled:opacity-40">
              <SkipForward size={15} />
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, last)}
              value={i < 0 ? 0 : i}
              disabled={rows.length < 2}
              onChange={(e) => {
                setPlaying(false)
                setIndex(Number(e.target.value))
              }}
              aria-label="Session"
              aria-valuetext={row ? `Session ${row.session_id ?? i + 1}, ${fmtEfc(row.efc)}` : undefined}
              className="h-1.5 flex-1 cursor-pointer accent-[rgb(var(--color-accent))] disabled:cursor-not-allowed"
            />
            <button type="button" onClick={() => { setPlaying(false); setIndex(null) }} disabled={index === null || i === last} className="hover-edge rounded-md border border-app-border px-2.5 py-1.5 text-xs font-medium text-text-primary hover:border-accent/40 disabled:opacity-40">
              Latest
            </button>
          </div>
        </Card>

        <Card radius="cardLg" className="p-5 lg:col-span-4">
          <CardHeader title="State at this session" subtitle="Values recorded by the server" />
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : !row ? (
            <p className="text-[13px] text-text-muted">No sessions recorded yet.</p>
          ) : (
            <dl>
              <Row label="Health index" value={row.health ? fmtSoh(row.health.soh) : DASH} />
              <Row label="Risk" value={row.health ? <RiskPill level={row.health.risk_level} /> : DASH} />
              <Row label="State of charge" value={fmtSoc(row.metrics?.soc)} />
              <Row label="Pack voltage" value={fmtVolt(row.metrics?.pack_voltage)} />
              <Row label="Current" value={fmtAmp(row.metrics?.current)} />
              <Row label="Temperature" value={fmtTemp(row.metrics?.temperature)} />
              <Row label="Voltage spread" value={fmtVoltSpread(row.metrics?.voltage_spread)} />
              <Row label="Temperature spread" value={fmtTempSpread(row.metrics?.temperature_spread)} />
              <Row label="Odometer" value={fmtKm(row.metrics?.odometer)} />
            </dl>
          )}
          {row && (!row.health || !row.metrics) && !loading && (
            <p className="mt-3 text-xs text-text-muted">{!row.health ? 'No health record exists for this session.' : 'No telemetry record exists for this session.'}</p>
          )}
        </Card>
      </section>

      <Card radius="cardLg" className="p-5">
        <CardHeader
          title="State evolution"
          subtitle="Click the chart to move the twin to that session."
          action={<SegmentedControl label="Measurement" value={chart} onChange={setChart} options={CHARTS.map((c) => ({ value: c.value, label: c.label }))} />}
        />
        {loading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
          <LineChart
            height={260}
            ariaLabel={`${def.label} across sessions`}
            series={[{ id: chart, label: def.label, color: 'accent', points }]}
            xLabel="Equivalent full cycles (EFC)"
            yLabel={def.yLabel}
            xFormat={(v) => Math.round(v).toLocaleString()}
            yFormat={def.tick}
            selectedX={selectedX}
            onSelect={(p) => {
              setPlaying(false)
              setIndex(p.k)
            }}
            emptyText="No sessions with EFC and this measurement yet."
            renderTooltip={([{ point }]) => (
              <>
                <p className="font-semibold text-text-primary">{point.row.session_id != null ? `Session #${point.row.session_id}` : 'Session'}</p>
                <p className="mt-0.5 text-text-secondary tabular">{def.label}: {def.fmt(point.y)}</p>
                <p className="text-text-secondary tabular">{fmtEfc(point.x)}</p>
              </>
            )}
          />
        )}
      </Card>
    </div>
  )
}
