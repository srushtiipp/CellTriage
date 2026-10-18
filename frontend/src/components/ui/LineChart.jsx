import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { niceTicks } from '../../lib/chart'

/**
 * LineChart: responsive, theme-aware SVG chart (no chart library).
 *
 * series:   [{ id, label, color, dashed, points: [{ x, y, ...meta }] }]   (y may be null => gap)
 * Hover shows a crosshair + tooltip; click calls onSelect(point). `selectedX` marks one x.
 * height:   a number (px) or 'fill' to take the height of the parent.
 */
const COLORS = {
  accent: 'rgb(var(--color-accent))',
  good: 'rgb(var(--color-success))',
  warn: 'rgb(var(--color-warning))',
  bad: 'rgb(var(--color-danger))',
  muted: 'rgb(var(--color-text-muted))',
  ink: 'rgb(var(--color-text-secondary))',
}
const M = { t: 14, r: 18, b: 44, l: 58 }

export default function LineChart({
  series,
  xLabel,
  yLabel,
  xFormat = (v) => String(v),
  yFormat = (v) => String(v),
  yDomain,
  referenceLines = [],
  selectedX = null,
  onSelect,
  renderTooltip,
  height = 260,
  ariaLabel = 'Line chart',
  showLegend,
  emptyText = 'No data to chart yet.',
}) {
  const wrapRef = useRef(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [hover, setHover] = useState(null) // index into primary series

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect
      setBox({ w: Math.floor(r.width), h: Math.floor(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const W = box.w
  const H = height === 'fill' ? Math.max(box.h, 190) : height
  const iw = Math.max(10, W - M.l - M.r)
  const ih = Math.max(10, H - M.t - M.b)

  const geom = useMemo(() => {
    const clean = series.map((s) => ({ ...s, points: s.points.filter((p) => Number.isFinite(p.x)) }))
    const xs = clean.flatMap((s) => s.points.map((p) => p.x))
    if (!xs.length) return null
    let xmin = Math.min(...xs)
    let xmax = Math.max(...xs)
    if (xmin === xmax) {
      xmin -= 1
      xmax += 1
    }
    const ys = clean.flatMap((s) => s.points.map((p) => p.y).filter((y) => Number.isFinite(y)))
    referenceLines.forEach((r) => ys.push(r.y))
    if (!ys.length) return null
    let ymin = yDomain ? yDomain[0] : Math.min(...ys)
    let ymax = yDomain ? yDomain[1] : Math.max(...ys)
    if (ymin === ymax) {
      ymin -= 1
      ymax += 1
    }
    if (!yDomain) {
      const pad = (ymax - ymin) * 0.08
      ymin -= pad
      ymax += pad
    }
    return { clean, xmin, xmax, ymin, ymax }
  }, [series, referenceLines, yDomain])

  const primary = geom?.clean.find((s) => s.points.length) ?? null

  const sx = useCallback((x) => M.l + ((x - geom.xmin) / (geom.xmax - geom.xmin)) * iw, [geom, iw])
  const sy = useCallback((y) => M.t + ih - ((y - geom.ymin) / (geom.ymax - geom.ymin)) * ih, [geom, ih])

  const nearestPoint = (clientX, rect) => {
    if (!geom || !geom.clean.length) return null
    // rect is the overlay <rect> starting at M.l; clamp relative position to [0, iw]
    const relX = Math.max(0, Math.min(iw, clientX - rect.left))
    const pointerSvgX = M.l + relX

    let bestPoint = null
    let bestDist = Infinity

    geom.clean.forEach((s) => {
      s.points.forEach((p) => {
        if (!Number.isFinite(p.x)) return
        const dist = Math.abs(sx(p.x) - pointerSvgX)
        if (dist < bestDist) {
          bestDist = dist
          bestPoint = p
        }
      })
    })

    return bestPoint
  }

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHover(nearestPoint(e.clientX, rect))
  }
  const onClick = (e) => {
    if (!onSelect) return
    const rect = e.currentTarget.getBoundingClientRect()
    const p = nearestPoint(e.clientX, rect)
    if (p) onSelect(p)
  }

  const legend = showLegend ?? series.length > 1

  const body = () => {
    if (W === 0) return null
    if (!geom) {
      return (
        <div className="flex h-full items-center justify-center text-[13px] text-text-muted" style={{ height: H }}>
          {emptyText}
        </div>
      )
    }
    const xt = niceTicks(geom.xmin, geom.xmax, W < 480 ? 4 : 7)
    const yt = niceTicks(geom.ymin, geom.ymax, H < 230 ? 4 : 6)
    const hp = hover
    const tipRight = hp ? sx(hp.x) > W * 0.55 : false
    const selPoint = selectedX !== null && primary ? primary.points.find((p) => p.x === selectedX) : null

    return (
      <>
        <svg width={W} height={H} role="img" aria-label={ariaLabel} className="block select-none overflow-visible">
          {yt.map((v) => (
            <g key={`y${v}`}>
              <line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} stroke="rgb(var(--color-border-muted))" strokeWidth="1" />
              <text x={M.l - 8} y={sy(v) + 4} textAnchor="end" fontSize="11" fill={COLORS.muted} className="tabular">
                {yFormat(v)}
              </text>
            </g>
          ))}
          {xt.map((v) => (
            <text key={`x${v}`} x={sx(v)} y={H - M.b + 17} textAnchor="middle" fontSize="11" fill={COLORS.muted} className="tabular">
              {xFormat(v)}
            </text>
          ))}
          <line x1={M.l} x2={W - M.r} y1={M.t + ih} y2={M.t + ih} stroke="rgb(var(--color-border))" />

          {referenceLines.map((r) => (
            <g key={r.label}>
              <line
                x1={M.l}
                x2={W - M.r}
                y1={sy(r.y)}
                y2={sy(r.y)}
                stroke={r.color || 'rgb(var(--color-warning))'}
                strokeDasharray="5 3"
                strokeWidth="1.5"
                strokeOpacity="0.85"
              />
              <text
                x={W - M.r - 4}
                y={sy(r.y) - 5}
                textAnchor="end"
                fontSize="10"
                fontWeight="600"
                fill={r.color || 'rgb(var(--color-warning))'}
                className="select-none"
              >
                {r.label}
              </text>
            </g>
          ))}

          {geom.clean.map((s) => {
            const color = COLORS[s.color] || s.color || COLORS.accent
            let d = ''
            let pen = false
            s.points.forEach((p) => {
              if (!Number.isFinite(p.y)) {
                pen = false
                return
              }
              d += `${pen ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`
              pen = true
            })
            const dots = s.points.length <= 70
            return (
              <g key={s.id}>
                <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 4' : undefined} />
                {dots &&
                  s.points.map((p) =>
                    Number.isFinite(p.y) ? <circle key={`${s.id}${p.x}${p.key ?? ''}`} cx={sx(p.x)} cy={sy(p.y)} r="2.4" fill={color} /> : null,
                  )}
              </g>
            )
          })}

          {selPoint && Number.isFinite(selPoint.y) && (
            <g>
              <line x1={sx(selPoint.x)} x2={sx(selPoint.x)} y1={M.t} y2={M.t + ih} stroke={COLORS.accent} strokeDasharray="3 3" strokeOpacity="0.7" />
              <circle cx={sx(selPoint.x)} cy={sy(selPoint.y)} r="6" fill="rgb(var(--color-surface))" stroke={COLORS.accent} strokeWidth="2" />
            </g>
          )}

          {hp && (
            <g pointerEvents="none">
              <line x1={sx(hp.x)} x2={sx(hp.x)} y1={M.t} y2={M.t + ih} stroke={COLORS.ink} strokeOpacity="0.35" />
              {geom.clean.map((s) => {
                const exact = s.points.find((p) => p.x === hp.x)
                const p = exact || (s.points.length ? s.points.reduce((a, b) => (Math.abs(b.x - hp.x) < Math.abs(a.x - hp.x) ? b : a), s.points[0]) : null)
                return p && Number.isFinite(p.y) ? (
                  <circle key={s.id} cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill="rgb(var(--color-surface))" stroke={COLORS[s.color] || s.color || COLORS.accent} strokeWidth="2" />
                ) : null
              })}
            </g>
          )}

          {xLabel && (
            <text x={M.l + iw / 2} y={H - 6} textAnchor="middle" fontSize="11.5" fontWeight="500" fill={COLORS.ink}>
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text transform={`translate(13 ${M.t + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize="11.5" fontWeight="500" fill={COLORS.ink}>
              {yLabel}
            </text>
          )}

          <rect
            x={M.l}
            y={M.t}
            width={iw}
            height={ih}
            fill="transparent"
            style={{ cursor: onSelect ? 'pointer' : 'crosshair' }}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onClick={onClick}
          />
        </svg>

        {hp && (
          <div
            role="presentation"
            className="pointer-events-none absolute z-30 min-w-[8.5rem] rounded-md border border-app-border bg-app-surface px-3 py-2 text-xs shadow-lift"
            style={{
              top: 8,
              [tipRight ? 'right' : 'left']: tipRight ? Math.max(8, W - sx(hp.x) + 12) : Math.max(8, sx(hp.x) + 12),
            }}
          >
            {renderTooltip
              ? renderTooltip(
                  geom.clean.map((s) => {
                    const exact = s.points.find((p) => p.x === hp.x)
                    const p = exact || (s.points.length ? s.points.reduce((a, b) => (Math.abs(b.x - hp.x) < Math.abs(a.x - hp.x) ? b : a), s.points[0]) : null)
                    return { series: s, point: p }
                  }),
                )
              : (
                <>
                  <p className="font-semibold text-text-primary tabular">{xFormat(hp.x)}</p>
                  {geom.clean.map((s) => {
                    const exact = s.points.find((q) => q.x === hp.x)
                    const p = exact || (s.points.length ? s.points.reduce((a, b) => (Math.abs(b.x - hp.x) < Math.abs(a.x - hp.x) ? b : a), s.points[0]) : null)
                    return (
                      <p key={s.id} className="mt-0.5 text-text-secondary tabular">
                        {s.label}: {p && Number.isFinite(p.y) ? yFormat(p.y) : '—'}
                      </p>
                    )
                  })}
                </>
              )}
          </div>
        )}
      </>
    )
  }

  return (
    <div className={height === 'fill' ? 'flex h-full min-h-0 flex-col' : undefined}>
      {legend && (
        <ul className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary" aria-label="Legend">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-5 rounded"
                style={{ background: COLORS[s.color] || s.color || COLORS.accent, opacity: s.dashed ? 0.7 : 1 }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div ref={wrapRef} className={`relative w-full ${height === 'fill' ? 'min-h-0 flex-1' : ''}`} style={height === 'fill' ? undefined : { height }}>
        {body()}
      </div>
    </div>
  )
}
