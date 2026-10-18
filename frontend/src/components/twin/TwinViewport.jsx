import { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Orbit, RotateCcw } from 'lucide-react'
import PackScene from './PackScene'
import useTheme from '../../hooks/useTheme'
import { PALETTE } from './packLayout'

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * Interactive pack-level view. Drag to orbit, scroll or pinch to zoom.
 * `soc` is the pack-level state of charge (0-100) or null when unknown.
 */
export default function TwinViewport({ soc, vehicleId = null, compact = false, className = '' }) {
  const { theme } = useTheme()
  const controlsRef = useRef(null)
  const [resetKey, setResetKey] = useState(0)
  const [autoRotate, setAutoRotate] = useState(false)
  const [supported] = useState(webglAvailable)
  const colors = PALETTE[theme === 'dark' ? 'dark' : 'light']
  const hasSoc = soc !== null && soc !== undefined && Number.isFinite(soc)

  return (
    <div className={`relative overflow-hidden rounded-md border border-app-border bg-app-surface2 ${className}`}>
      {supported ? (
        <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} aria-label="Illustrative 3D battery pack">
          <PackScene soc={hasSoc ? soc : 0} theme={theme} controlsRef={controlsRef} resetKey={resetKey} autoRotate={autoRotate} />
        </Canvas>
      ) : (
        <div className="flex h-full min-h-[14rem] items-center justify-center px-6 text-center text-[13px] text-text-secondary">
          The 3D view needs WebGL, which is unavailable in this browser. All values for the selected session are still shown beside it.
        </div>
      )}

      {supported && !hasSoc && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-md border border-app-border bg-app-surface/90 px-3 py-1.5 text-xs text-text-muted backdrop-blur-sm">
            State of charge (SOC) not recorded for this session
          </span>
        </div>
      )}

      {supported && (
        <>
          <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
            {vehicleId && (
              <span className="rounded border border-app-border bg-app-surface/90 px-2 py-1 font-mono text-[11px] font-semibold text-text-primary">
                {vehicleId}
              </span>
            )}
            <button
              type="button"
              onClick={() => setAutoRotate((a) => !a)}
              aria-pressed={autoRotate}
              aria-label="Toggle auto-rotate"
              title="Auto-rotate"
              className={`hover-edge rounded-md border p-1.5 ${autoRotate ? 'border-accent/50 bg-accent-dim text-accent-strong' : 'border-app-border bg-app-surface text-text-secondary hover:text-text-primary'}`}
            >
              <Orbit size={14} />
            </button>
            <button
              type="button"
              onClick={() => setResetKey((k) => k + 1)}
              aria-label="Reset view"
              title="Reset view"
              className="hover-edge rounded-md border border-app-border bg-app-surface p-1.5 text-text-secondary hover:text-text-primary"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 flex flex-wrap items-end justify-between gap-2 text-[11px] text-text-secondary">
            <span className="rounded bg-app-surface/90 px-2.5 py-1 font-medium shadow-sm">
              {compact ? (
                <>Illustrative pack view · Fill = Pack SOC {hasSoc ? `(${Math.round(soc)}%)` : '(N/A)'}</>
              ) : (
                <>
                  <span className="font-semibold text-text-primary">Illustrative 12-block layout</span>
                  <span className="text-text-muted"> · Pack-level telemetry only · Not a cell thermal/fault map</span>
                </>
              )}
            </span>
            {!compact && (
              <span className="flex items-center gap-3 rounded bg-app-surface/90 px-2.5 py-1 shadow-sm">
                <span className="flex items-center gap-1.5 font-medium text-text-primary">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: colors.fill }} />
                  Fill height: Recorded Pack SOC ({hasSoc ? `${Math.round(soc)}%` : 'No data'})
                </span>
                <span className="flex items-center gap-1.5 text-text-muted">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: colors.shell }} />
                  Uncharged headroom
                </span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
