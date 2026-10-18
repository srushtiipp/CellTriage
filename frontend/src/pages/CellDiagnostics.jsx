import { useMemo, useState } from 'react'
import { Scale, Waves } from 'lucide-react'
import Card from '../components/ui/Card'
import CardHeader from '../components/ui/CardHeader'
import DataTable from '../components/ui/DataTable'
import LineChart from '../components/ui/LineChart'
import MetricTile from '../components/ui/MetricTile'
import Notice from '../components/ui/Notice'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'
import { useVehicleData } from '../context/VehicleDataContext'
import { describeError } from '../lib/apiClient'
import { DASH, fmtEfc, fmtInt, fmtSoh, fmtTempSpread, fmtVoltSpread } from '../lib/format'
import { numbers, stats } from '../lib/sessions'
import RiskPill from '../components/ui/RiskPill'

const rowKey = (r) => r.key ?? `i${r.index}`
const sessionLabel = (r) => (r?.session_id != null ? `session #${r.session_id}` : undefined)

export default function CellDiagnostics() {
  const { vehicleId, metrics, timeline, reload } = useVehicleData()
  const rows = timeline.withMetrics
  const [picked, setPicked] = useState(null)
  const loading = metrics.status === 'loading'
  const failed = metrics.status === 'error'

  const withV = rows.filter((r) => r.metrics.voltage_spread !== null)
  const withT = rows.filter((r) => r.metrics.temperature_spread !== null)
  const maxV = withV.length ? withV.reduce((a, b) => (b.metrics.voltage_spread > a.metrics.voltage_spread ? b : a)) : null
  const maxT = withT.length ? withT.reduce((a, b) => (b.metrics.temperature_spread > a.metrics.temperature_spread ? b : a)) : null
  const latest = rows.at(-1) ?? null
  const medV = stats.median(numbers(rows, (r) => r.metrics.voltage_spread))

  const vPoints = rows.filter((r) => r.efc !== null && r.metrics.voltage_spread !== null).map((r) => ({ x: r.efc, y: r.metrics.voltage_spread * 1000, key: rowKey(r), row: r }))
  const tPoints = rows.filter((r) => r.efc !== null && r.metrics.temperature_spread !== null).map((r) => ({ x: r.efc, y: r.metrics.temperature_spread, key: rowKey(r), row: r }))

  const top = useMemo(() => [...withV].sort((a, b) => b.metrics.voltage_spread - a.metrics.voltage_spread).slice(0, 8), [withV])
  const selected = rows.find((r) => rowKey(r) === picked) ?? null
  const selectedX = selected?.efc ?? null

  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="Cell Diagnostics" subtitle={`How evenly the pack of vehicle ${vehicleId} was balanced in each recorded session.`} />

      {failed && <Notice tone="bad" title="Telemetry unavailable" onRetry={reload}>{describeError(metrics.error, 'session telemetry')}</Notice>}

      <Notice title="Pack-level BMS summary metrics only">
        The fleet dataset does not provide individual cell voltages or per-cell temperature sensor telemetry. It provides each session’s
        <strong> voltage spread</strong> (difference between highest and lowest cell voltage in mV) and
        <strong> temperature spread</strong> (difference between highest and lowest pack temperature sensor in °C).
        A larger spread is an operational indicator that warrants diagnostic inspection or cell-balancing verification, not definitive proof of a cell defect or physical failure.
      </Notice>

      <section aria-label="Spread summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile icon={Scale} label="Latest voltage spread" value={fmtVoltSpread(latest?.metrics.voltage_spread)} hint={sessionLabel(latest)} loading={loading} error={failed} />
        <MetricTile icon={Scale} label="Highest voltage spread" value={fmtVoltSpread(maxV?.metrics.voltage_spread)} hint={sessionLabel(maxV)} loading={loading} error={failed} />
        <MetricTile icon={Waves} label="Latest temperature spread" value={fmtTempSpread(latest?.metrics.temperature_spread)} hint={sessionLabel(latest)} loading={loading} error={failed} />
        <MetricTile icon={Waves} label="Highest temperature spread" value={fmtTempSpread(maxT?.metrics.temperature_spread)} hint={sessionLabel(maxT)} loading={loading} error={failed} />
      </section>

      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
        <Card radius="cardLg" className="p-5">
          <CardHeader title="Voltage spread" subtitle={medV !== null ? `Median across sessions: ${fmtVoltSpread(medV)}` : 'Across cells, per session'} />
          {loading ? <Skeleton className="h-[250px] w-full" /> : failed ? null : (
            <LineChart
              height={250}
              ariaLabel="Voltage spread across sessions"
              series={[{ id: 'vs', label: 'Voltage spread', color: 'accent', points: vPoints }]}
              xLabel="Equivalent full cycles (EFC)"
              yLabel="Voltage spread (mV)"
              xFormat={(v) => Math.round(v).toLocaleString()}
              yFormat={(v) => `${Math.round(v)}`}
              selectedX={selectedX}
              onSelect={(p) => setPicked(p.key)}
              emptyText="No voltage spread values recorded."
              renderTooltip={([{ point }]) => (
                <>
                  <p className="font-semibold text-text-primary">{point.row.session_id != null ? `Session #${point.row.session_id}` : 'Session'}</p>
                  <p className="mt-0.5 text-text-secondary tabular">{fmtVoltSpread(point.row.metrics.voltage_spread)}</p>
                  <p className="text-text-secondary tabular">{fmtEfc(point.row.efc)}</p>
                </>
              )}
            />
          )}
        </Card>
        <Card radius="cardLg" className="p-5">
          <CardHeader title="Temperature spread" subtitle="Across sensors, per session" />
          {loading ? <Skeleton className="h-[250px] w-full" /> : failed ? null : (
            <LineChart
              height={250}
              ariaLabel="Temperature spread across sessions"
              series={[{ id: 'ts', label: 'Temperature spread', color: 'warn', points: tPoints }]}
              xLabel="Equivalent full cycles (EFC)"
              yLabel="Temperature spread (°C)"
              xFormat={(v) => Math.round(v).toLocaleString()}
              yFormat={(v) => `${Math.round(v * 10) / 10}`}
              selectedX={selectedX}
              onSelect={(p) => setPicked(p.key)}
              emptyText="No temperature spread values recorded."
              renderTooltip={([{ point }]) => (
                <>
                  <p className="font-semibold text-text-primary">{point.row.session_id != null ? `Session #${point.row.session_id}` : 'Session'}</p>
                  <p className="mt-0.5 text-text-secondary tabular">{fmtTempSpread(point.row.metrics.temperature_spread)}</p>
                  <p className="text-text-secondary tabular">{fmtEfc(point.row.efc)}</p>
                </>
              )}
            />
          )}
        </Card>
      </section>

      <Card radius="cardLg" className="p-5">
        <CardHeader title="Sessions with the widest voltage spread" subtitle="Largest first. Click a row to mark it on both charts." />
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <DataTable
            caption="Sessions ranked by voltage spread"
            rows={top}
            rowKey={rowKey}
            selectedKey={selected ? rowKey(selected) : undefined}
            onRowClick={(r) => setPicked(rowKey(r))}
            emptyText="No voltage spread values recorded."
            columns={[
              { key: 's', label: 'Session', render: (r) => (r.session_id != null ? `#${r.session_id}` : DASH) },
              { key: 'e', label: 'EFC', align: 'right', render: (r) => fmtInt(r.efc) },
              { key: 'v', label: 'Voltage spread', align: 'right', render: (r) => fmtVoltSpread(r.metrics.voltage_spread) },
              { key: 't', label: 'Temp. spread', align: 'right', render: (r) => fmtTempSpread(r.metrics.temperature_spread) },
              { key: 'h', label: 'Health index', align: 'right', render: (r) => (r.health ? fmtSoh(r.health.soh) : DASH) },
              { key: 'r', label: 'Risk', render: (r) => (r.health ? <RiskPill level={r.health.risk_level} /> : DASH) },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
