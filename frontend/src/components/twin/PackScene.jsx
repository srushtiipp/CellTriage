import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { buildModules, MODULE_D, MODULE_H, MODULE_W, PACK_D, PACK_W, PALETTE, TRAY_H } from './packLayout'

// Camera framing: pack is wide and flat, so look from a modest elevation and slight diagonal.
const FOV = 45
const ELEV = (26 * Math.PI) / 180
const AZ = (18 * Math.PI) / 180
const TARGET = [0, 0.5, 0]

/** Camera distance at which the pack fills the viewport width, whatever its aspect ratio. */
function fitDistance(aspect) {
  const halfV = (FOV * Math.PI) / 360
  const halfH = Math.atan(Math.tan(halfV) * Math.max(aspect, 0.3))
  // Half-width of the pack as seen from the camera azimuth, with margin for perspective (near corners look larger).
  const extent = ((PACK_W / 2) * Math.cos(AZ) + (PACK_D / 2) * Math.sin(AZ)) * 1.3
  const d = extent / Math.tan(halfH)
  return Math.min(48, Math.max(14, d))
}

function positionAt(d) {
  return [
    d * Math.cos(ELEV) * Math.sin(AZ),
    TARGET[1] + d * Math.sin(ELEV),
    d * Math.cos(ELEV) * Math.cos(AZ),
  ]
}
const START = positionAt(20)

const modules = buildModules()

/** Re-frames the camera whenever `resetKey` changes. */
function ViewReset({ controlsRef, resetKey }) {
  const camera = useThree((s) => s.camera)
  const get = useThree((s) => s.get)
  useEffect(() => {
    if (!controlsRef.current) return
    const { width, height } = get().size
    camera.position.set(...positionAt(fitDistance(width / height)))
    controlsRef.current.target.set(...TARGET)
    controlsRef.current.update()
  }, [resetKey, camera, controlsRef, get])
  return null
}

function Module({ position, soc, colors }) {
  const w = MODULE_W - 0.3
  const d = MODULE_D - 0.3
  const inner = MODULE_H - TRAY_H
  const outline = useMemo(() => {
    const box = new THREE.BoxGeometry(w, inner, d)
    const e = new THREE.EdgesGeometry(box)
    box.dispose()
    return e
  }, [w, inner, d])
  useEffect(() => () => outline.dispose(), [outline])
  const fillH = soc === null ? 0 : Math.max(0.02, (inner * Math.min(100, Math.max(0, soc))) / 100)
  return (
    <group position={position}>
      <mesh position={[0, TRAY_H / 2, 0]}>
        <boxGeometry args={[MODULE_W, TRAY_H, MODULE_D]} />
        <meshStandardMaterial color={colors.tray} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* empty shell */}
      <mesh position={[0, TRAY_H + inner / 2, 0]}>
        <boxGeometry args={[w, inner, d]} />
        <meshStandardMaterial color={colors.shell} transparent opacity={0.45} roughness={0.7} depthWrite={false} />
      </mesh>
      {/* charged portion: height = pack state of charge */}
      {fillH > 0 && (
        <mesh position={[0, TRAY_H + fillH / 2, 0]}>
          <boxGeometry args={[w - 0.04, fillH, d - 0.04]} />
          <meshStandardMaterial color={colors.fill} roughness={0.5} metalness={0.15} />
        </mesh>
      )}
      <lineSegments position={[0, TRAY_H + inner / 2, 0]} geometry={outline}>
        <lineBasicMaterial color={colors.edge} transparent opacity={0.65} />
      </lineSegments>
    </group>
  )
}

/**
 * Scene contents. `soc` is the pack-level state of charge (0-100) or null.
 * Controls are damped and bounded so zooming and orbiting feel smooth.
 */
export default function PackScene({ soc, theme, controlsRef, resetKey, autoRotate }) {
  const colors = PALETTE[theme === 'dark' ? 'dark' : 'light']
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[8, 12, 8]} intensity={0.85} />
      <directionalLight position={[-8, 5, -6]} intensity={0.3} />
      <PerspectiveCamera makeDefault position={START} fov={FOV} near={0.5} far={160} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={TARGET}
        enablePan={false}
        enableDamping
        dampingFactor={0.09}
        rotateSpeed={0.7}
        zoomSpeed={0.7}
        minDistance={6}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate={autoRotate}
        autoRotateSpeed={1.1}
      />
      <ViewReset controlsRef={controlsRef} resetKey={resetKey} />
      {modules.map((m) => (
        <Module key={m.index} position={m.position} soc={soc} colors={colors} />
      ))}
    </>
  )
}
