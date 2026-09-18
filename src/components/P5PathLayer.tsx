import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { HOME_SOURCE } from '../sceneConfig'

type RenderedHomeRect = {
  left: number
  top: number
  width: number
  height: number
  sourceScale: number
}

type RoadHandle = 'start' | 'control1' | 'control2' | 'end'

type RoadTuning = {
  startX: number
  startY: number
  control1X: number
  control1Y: number
  control2X: number
  control2Y: number
  endX: number
  endY: number
  walkDurationMs: number
  cyclePauseMs: number
  footGap: number
  footLifetimeMs: number
  footWidth: number
  footStartScale: number
  footEndScale: number
  footSideOffset: number
  particleCount: number
  particleSpread: number
  particleOpacity: number
}

type Footstep = {
  progress: number
  bornAt: number
  side: -1 | 1
  twist: number
}

type ParticleSeed = {
  progressOffset: number
  side: number
  lift: number
  radius: number
  phase: number
}

type RangeRowProps = {
  label: string
  field: keyof RoadTuning
  value: RoadTuning
  onChange: (next: RoadTuning) => void
  min: number
  max: number
  step: number
  suffix?: string
}

const FOOT_SRC = `${import.meta.env.BASE_URL}assets/foot.png`
const ROAD_STORAGE_KEY = 'pawcream-road-tuning-v2'
const LEGACY_ROAD_STORAGE_KEY = 'pawcream-road-tuning-v1'
const MAX_PARTICLE_SEEDS = 100

const ROAD_TUNING_DEFAULTS: RoadTuning = {
  startX: 626,
  startY: 1535,
  control1X: 806,
  control1Y: 1459,
  control2X: 943,
  control2Y: 1338,
  endX: 1037,
  endY: 1127,
  walkDurationMs: 3500,
  cyclePauseMs: 700,
  footGap: 0.165,
  footLifetimeMs: 2500,
  footWidth: 162,
  footStartScale: 0.9,
  footEndScale: 0.55,
  footSideOffset: 32,
  particleCount: 9,
  particleSpread: 34,
  particleOpacity: 0.23,
}

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: 16,
  left: 16,
  zIndex: 31,
  width: 'min(330px, calc(100vw - 32px))',
  maxHeight: 'calc(100vh - 32px)',
  overflow: 'auto',
  border: '1px solid rgba(221, 156, 188, 0.42)',
  borderRadius: 18,
  background: 'rgba(255, 249, 252, 0.91)',
  boxShadow: '0 12px 38px rgba(120, 86, 104, 0.13)',
  backdropFilter: 'blur(14px)',
  color: '#654f5b',
  fontFamily: 'inherit',
}

const sectionStyle: CSSProperties = {
  padding: '12px 14px',
  borderTop: '1px solid rgba(221, 156, 188, 0.18)',
}

const buttonStyle: CSSProperties = {
  border: '1px solid rgba(211, 143, 177, 0.45)',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.84)',
  color: '#7d5c6d',
  padding: '7px 11px',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 12,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function clamp01(value: number) {
  return clamp(value, 0, 1)
}

function cloneRoadDefaults(): RoadTuning {
  return { ...ROAD_TUNING_DEFAULTS }
}

function loadRoadTuning(tuneMode: boolean): RoadTuning {
  if (!tuneMode || typeof window === 'undefined') return cloneRoadDefaults()

  try {
    const raw =
      window.localStorage.getItem(ROAD_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_ROAD_STORAGE_KEY)
    if (!raw) return cloneRoadDefaults()

    const parsed = JSON.parse(raw) as Partial<Record<keyof RoadTuning, unknown>>
    const next = cloneRoadDefaults()

    for (const key of Object.keys(next) as Array<keyof RoadTuning>) {
      const candidate = parsed[key]
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        next[key] = candidate
      }
    }

    return next
  } catch {
    return cloneRoadDefaults()
  }
}

function getRenderedHomeRect(): RenderedHomeRect | null {
  const artboard = document.querySelector<HTMLElement>('.home-artboard')
  if (!artboard) return null

  const container = artboard.getBoundingClientRect()
  const sourceRatio = HOME_SOURCE.width / HOME_SOURCE.height
  const containerRatio = container.width / container.height

  let width: number
  let height: number

  if (sourceRatio > containerRatio) {
    width = container.width
    height = width / sourceRatio
  } else {
    height = container.height
    width = height * sourceRatio
  }

  return {
    left: container.left + (container.width - width) / 2,
    top: container.top + (container.height - height) / 2,
    width,
    height,
    sourceScale: width / HOME_SOURCE.width,
  }
}

function isHomeAwake() {
  const scene = document.querySelector<HTMLElement>('.home-scene')
  if (!scene) return false
  return (
    scene.classList.contains('home-scene--awake') ||
    scene.classList.contains('home-scene--entering') ||
    scene.classList.contains('home-scene--tuning')
  )
}

function getRoadPoint(tuning: RoadTuning, handle: RoadHandle) {
  switch (handle) {
    case 'start': return { x: tuning.startX, y: tuning.startY }
    case 'control1': return { x: tuning.control1X, y: tuning.control1Y }
    case 'control2': return { x: tuning.control2X, y: tuning.control2Y }
    case 'end': return { x: tuning.endX, y: tuning.endY }
  }
}

function updateRoadPoint(
  tuning: RoadTuning,
  handle: RoadHandle,
  point: { x: number; y: number },
): RoadTuning {
  const x = Math.round(clamp(point.x, 0, HOME_SOURCE.width))
  const y = Math.round(clamp(point.y, 0, HOME_SOURCE.height))

  switch (handle) {
    case 'start': return { ...tuning, startX: x, startY: y }
    case 'control1': return { ...tuning, control1X: x, control1Y: y }
    case 'control2': return { ...tuning, control2X: x, control2Y: y }
    case 'end': return { ...tuning, endX: x, endY: y }
  }
}

function cubicPoint(t: number, tuning: RoadTuning) {
  const u = 1 - t
  const uu = u * u
  const tt = t * t
  return {
    x:
      uu * u * tuning.startX +
      3 * uu * t * tuning.control1X +
      3 * u * tt * tuning.control2X +
      tt * t * tuning.endX,
    y:
      uu * u * tuning.startY +
      3 * uu * t * tuning.control1Y +
      3 * u * tt * tuning.control2Y +
      tt * t * tuning.endY,
  }
}

function cubicTangent(t: number, tuning: RoadTuning) {
  const u = 1 - t
  return {
    x:
      3 * u * u * (tuning.control1X - tuning.startX) +
      6 * u * t * (tuning.control2X - tuning.control1X) +
      3 * t * t * (tuning.endX - tuning.control2X),
    y:
      3 * u * u * (tuning.control1Y - tuning.startY) +
      6 * u * t * (tuning.control2Y - tuning.control1Y) +
      3 * t * t * (tuning.endY - tuning.control2Y),
  }
}

function sourceToViewport(point: { x: number; y: number }, rect: RenderedHomeRect) {
  return {
    x: rect.left + point.x * rect.sourceScale,
    y: rect.top + point.y * rect.sourceScale,
  }
}

function viewportToSource(clientX: number, clientY: number, rect: RenderedHomeRect) {
  return {
    x: (clientX - rect.left) / rect.sourceScale,
    y: (clientY - rect.top) / rect.sourceScale,
  }
}

function seededParticles(): ParticleSeed[] {
  return Array.from({ length: MAX_PARTICLE_SEEDS }, (_, index) => {
    const n = index + 1
    return {
      progressOffset: -0.19 + (((n * 37) % 100) / 100) * 0.23,
      side: -1 + (((n * 53) % 100) / 100) * 2,
      lift: -12 - (((n * 71) % 100) / 100) * 30,
      radius: 1.7 + (((n * 29) % 100) / 100) * 3.2,
      phase: (((n * 43) % 100) / 100) * Math.PI * 2,
    }
  })
}

function formatNumber(value: number, step: number) {
  return step < 1 ? value.toFixed(step < 0.01 ? 3 : 2) : String(Math.round(value))
}

function RangeRow({
  label,
  field,
  value,
  onChange,
  min,
  max,
  step,
  suffix = '',
}: RangeRowProps) {
  const current = value[field]

  return (
    <label style={{
      display: 'grid',
      gridTemplateColumns: '88px 1fr 58px',
      alignItems: 'center',
      gap: 8,
      margin: '8px 0',
      fontSize: 12,
    }}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(event) => onChange({
          ...value,
          [field]: Number(event.currentTarget.value),
        })}
        style={{ width: '100%' }}
      />
      <output style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {formatNumber(current, step)}{suffix}
      </output>
    </label>
  )
}

function handleStyle(point: { x: number; y: number }, active: boolean): CSSProperties {
  return {
    position: 'fixed',
    left: point.x,
    top: point.y,
    zIndex: 29,
    width: 34,
    height: 34,
    transform: 'translate(-50%, -50%)',
    borderRadius: '50%',
    border: `2px solid ${active ? '#d56f9d' : '#eca6c3'}`,
    background: active ? 'rgba(255, 232, 242, 0.98)' : 'rgba(255,255,255,0.9)',
    boxShadow: '0 4px 16px rgba(170, 93, 129, 0.2)',
    cursor: 'grab',
    touchAction: 'none',
    padding: 0,
  }
}

export default function P5PathLayer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<{ handle: RoadHandle; pointerId: number } | null>(null)
  const tuneMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tune') === '1',
    [],
  )
  const [tuning, setTuning] = useState<RoadTuning>(() => loadRoadTuning(tuneMode))
  const tuningRef = useRef(tuning)
  const [renderedRect, setRenderedRect] = useState<RenderedHomeRect | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [copyStatus, setCopyStatus] = useState('复制脚印参数')
  const [activeHandle, setActiveHandle] = useState<RoadHandle>('start')

  tuningRef.current = tuning

  useEffect(() => {
    if (!tuneMode) return
    window.localStorage.setItem(ROAD_STORAGE_KEY, JSON.stringify(tuning))
  }, [tuneMode, tuning])

  useEffect(() => {
    if (!tuneMode) return

    const update = () => setRenderedRect(getRenderedHomeRect())
    update()

    const artboard = document.querySelector<HTMLElement>('.home-artboard')
    const observer = new ResizeObserver(update)
    if (artboard) observer.observe(artboard)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
    }
  }, [tuneMode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const footImage = new Image()
    footImage.src = FOOT_SRC

    const particleSeeds = seededParticles()
    const footsteps: Footstep[] = []
    let animationFrame = 0
    let cycleStartedAt = performance.now()
    let lastStepIndex = -1
    let lastCycleIndex = 0
    let activity = 0
    let wasAwake = false

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(window.innerWidth * dpr))
      canvas.height = Math.max(1, Math.round(window.innerHeight * dpr))
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const addFootstepsUpTo = (progress: number, time: number, current: RoadTuning) => {
      const gap = Math.max(0.02, current.footGap)
      const nextStepIndex = Math.floor(progress / gap)
      while (lastStepIndex < nextStepIndex) {
        lastStepIndex += 1
        const stepProgress = Math.min(0.96, lastStepIndex * gap)
        footsteps.push({
          progress: stepProgress,
          bornAt: time,
          side: lastStepIndex % 2 === 0 ? -1 : 1,
          twist: lastStepIndex % 2 === 0 ? -0.045 : 0.045,
        })
      }
    }

    const drawFootstep = (
      foot: Footstep,
      time: number,
      rect: RenderedHomeRect,
      current: RoadTuning,
    ) => {
      if (!footImage.complete || footImage.naturalWidth <= 0) return

      const age = time - foot.bornAt
      const life = clamp01(1 - age / current.footLifetimeMs)
      if (life <= 0) return

      const point = cubicPoint(foot.progress, current)
      const tangent = cubicTangent(foot.progress, current)
      const tangentLength = Math.max(1, Math.hypot(tangent.x, tangent.y))
      const normalX = -tangent.y / tangentLength
      const normalY = tangent.x / tangentLength
      const lateral = current.footSideOffset * foot.side
      const viewport = sourceToViewport({
        x: point.x + normalX * lateral,
        y: point.y + normalY * lateral,
      }, rect)

      const direction = Math.atan2(tangent.y, tangent.x) + Math.PI / 2 + foot.twist
      const fadeIn = clamp01(age / 260)
      const fadeOut = age > current.footLifetimeMs - 1200
        ? clamp01((current.footLifetimeMs - age) / 1200)
        : 1
      const alpha = 0.58 * fadeIn * fadeOut * activity

      const roadScale =
        current.footStartScale +
        (current.footEndScale - current.footStartScale) * foot.progress
      const sourceWidth = current.footWidth * Math.max(0.05, roadScale)
      const width = sourceWidth * rect.sourceScale
      const aspect = footImage.naturalHeight / footImage.naturalWidth
      const height = width * aspect
      const pop = 0.86 + 0.14 * Math.min(1, age / 320)

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(viewport.x, viewport.y)
      ctx.rotate(direction)
      ctx.scale(pop, pop)
      ctx.drawImage(footImage, -width / 2, -height / 2, width, height)
      ctx.restore()
    }

    const drawParticleTrail = (
      walkerProgress: number,
      time: number,
      rect: RenderedHomeRect,
      current: RoadTuning,
    ) => {
      const count = Math.round(clamp(current.particleCount, 0, MAX_PARTICLE_SEEDS))
      for (let index = 0; index < count; index += 1) {
        const seed = particleSeeds[index]
        const t = clamp01(walkerProgress + seed.progressOffset)
        if (t <= 0 || t >= 1) continue

        const point = cubicPoint(t, current)
        const tangent = cubicTangent(t, current)
        const tangentLength = Math.max(1, Math.hypot(tangent.x, tangent.y))
        const normalX = -tangent.y / tangentLength
        const normalY = tangent.x / tangentLength
        const shimmer = Math.sin(time * 0.0035 + seed.phase)
        const side = seed.side * current.particleSpread
        const viewport = sourceToViewport({
          x: point.x + normalX * (side + shimmer * 7),
          y: point.y + normalY * (side + shimmer * 7) + seed.lift + shimmer * 5,
        }, rect)
        const radius = seed.radius * (0.75 + t * 0.25) * Math.max(0.72, rect.sourceScale * 2.2)
        const distanceFromHead = Math.abs(t - walkerProgress)
        const alpha = Math.max(0, current.particleOpacity - distanceFromHead * 1.35) * activity

        ctx.beginPath()
        ctx.arc(viewport.x, viewport.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 181, 218, ${alpha})`
        ctx.fill()

        if ((Math.round(seed.phase * 10) + Math.round(time / 220)) % 5 === 0) {
          const arm = radius * 2.1
          ctx.strokeStyle = `rgba(255, 205, 229, ${alpha * 0.8})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(viewport.x - arm, viewport.y)
          ctx.lineTo(viewport.x + arm, viewport.y)
          ctx.moveTo(viewport.x, viewport.y - arm)
          ctx.lineTo(viewport.x, viewport.y + arm)
          ctx.stroke()
        }
      }
    }

    const draw = (time: number) => {
      const current = tuningRef.current
      const awake = isHomeAwake()
      const rect = getRenderedHomeRect()
      activity += ((awake ? 1 : 0) - activity) * 0.075

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      if (awake && !wasAwake) {
        cycleStartedAt = time
        lastStepIndex = -1
        lastCycleIndex = 0
      }
      wasAwake = awake

      if (rect && activity > 0.01) {
        const walkDuration = Math.max(300, current.walkDurationMs)
        const cycleLength = walkDuration + Math.max(0, current.cyclePauseMs)
        const elapsed = Math.max(0, time - cycleStartedAt)
        const cyclePosition = elapsed % cycleLength
        const cycleIndex = Math.floor(elapsed / cycleLength)
        const walkerProgress = cyclePosition < walkDuration
          ? clamp01(cyclePosition / walkDuration)
          : 1

        if (cycleIndex !== lastCycleIndex) {
          lastCycleIndex = cycleIndex
          lastStepIndex = -1
        }

        if (awake && cyclePosition < walkDuration) {
          addFootstepsUpTo(walkerProgress, time, current)
        }

        drawParticleTrail(walkerProgress, time, rect, current)
        for (const foot of footsteps) drawFootstep(foot, time, rect, current)
      }

      for (let index = footsteps.length - 1; index >= 0; index -= 1) {
        if (time - footsteps[index].bornAt > tuningRef.current.footLifetimeMs) {
          footsteps.splice(index, 1)
        }
      }

      animationFrame = window.requestAnimationFrame(draw)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    animationFrame = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  const pathPoints = renderedRect ? {
    start: sourceToViewport(getRoadPoint(tuning, 'start'), renderedRect),
    control1: sourceToViewport(getRoadPoint(tuning, 'control1'), renderedRect),
    control2: sourceToViewport(getRoadPoint(tuning, 'control2'), renderedRect),
    end: sourceToViewport(getRoadPoint(tuning, 'end'), renderedRect),
  } : null

  const updateFromPointer = (handle: RoadHandle, clientX: number, clientY: number) => {
    if (!renderedRect) return
    setTuning((current) => updateRoadPoint(
      current,
      handle,
      viewportToSource(clientX, clientY, renderedRect),
    ))
  }

  const onHandlePointerDown = (
    handle: RoadHandle,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    setActiveHandle(handle)
    dragRef.current = { handle, pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromPointer(handle, event.clientX, event.clientY)
  }

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    updateFromPointer(drag.handle, event.clientX, event.clientY)
  }

  const onHandlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const copySettings = async () => {
    const text = `ROAD_TUNING_DEFAULTS = ${JSON.stringify(tuning, null, 2)}`
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('已复制')
      window.setTimeout(() => setCopyStatus('复制脚印参数'), 1200)
    } catch {
      setCopyStatus('复制失败')
      window.setTimeout(() => setCopyStatus('复制脚印参数'), 1600)
    }
  }

  const renderHandle = (
    handle: RoadHandle,
    label: string,
    point: { x: number; y: number },
  ) => (
    <button
      key={handle}
      type="button"
      aria-label={`拖动 ${label}`}
      style={handleStyle(point, activeHandle === handle)}
      onPointerDown={(event) => onHandlePointerDown(handle, event)}
      onPointerMove={onHandlePointerMove}
      onPointerUp={onHandlePointerUp}
      onPointerCancel={onHandlePointerUp}
    >
      <span style={{
        position: 'absolute',
        top: 38,
        left: '50%',
        transform: 'translateX(-50%)',
        whiteSpace: 'nowrap',
        padding: '2px 6px',
        borderRadius: 999,
        background: 'rgba(255,248,252,.94)',
        color: '#9b5f7c',
        fontSize: 10,
        fontWeight: 700,
        pointerEvents: 'none',
      }}>
        {label}
      </span>
    </button>
  )

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 4 }}
      />

      {tuneMode && pathPoints && (
        <>
          <svg
            aria-hidden="true"
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 28,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            <line
              x1={pathPoints.start.x}
              y1={pathPoints.start.y}
              x2={pathPoints.control1.x}
              y2={pathPoints.control1.y}
              stroke="rgba(215,111,157,.34)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
            <line
              x1={pathPoints.control2.x}
              y1={pathPoints.control2.y}
              x2={pathPoints.end.x}
              y2={pathPoints.end.y}
              stroke="rgba(215,111,157,.34)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
            <path
              d={`M ${pathPoints.start.x} ${pathPoints.start.y} C ${pathPoints.control1.x} ${pathPoints.control1.y}, ${pathPoints.control2.x} ${pathPoints.control2.y}, ${pathPoints.end.x} ${pathPoints.end.y}`}
              fill="none"
              stroke="rgba(213,111,157,.86)"
              strokeWidth="2.5"
              strokeDasharray="7 6"
            />
          </svg>

          {renderHandle('start', 'foot start', pathPoints.start)}
          {renderHandle('control1', 'curve 1', pathPoints.control1)}
          {renderHandle('control2', 'curve 2', pathPoints.control2)}
          {renderHandle('end', 'foot end', pathPoints.end)}
        </>
      )}

      {tuneMode && (
        <aside style={panelStyle}>
          <header style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '11px 14px',
          }}>
            <div>
              <strong style={{ display: 'block', fontSize: 13 }}>Footprint Tune</strong>
              <span style={{ fontSize: 10, opacity: 0.64 }}>小路 / 脚印 / 魔法粒子</span>
            </div>
            <button
              type="button"
              style={buttonStyle}
              onClick={() => setCollapsed((current) => !current)}
            >
              {collapsed ? '展开' : '收起'}
            </button>
          </header>

          {!collapsed && (
            <div>
              <p style={{ margin: 0, padding: '0 14px 11px', fontSize: 11, lineHeight: 1.55, opacity: 0.72 }}>
                粉色虚线就是脚印轨迹。拖动 start / curve 1 / curve 2 / end 可直接改路线；“出生倍率 / 结束倍率”控制脚印沿路线由大变小或由小变大。
              </p>

              <section style={sectionStyle}>
                <strong style={{ fontSize: 12 }}>脚印外观</strong>
                <RangeRow label="基础大小" field="footWidth" value={tuning} onChange={setTuning} min={40} max={280} step={2} suffix="px" />
                <RangeRow label="出生倍率" field="footStartScale" value={tuning} onChange={setTuning} min={0.2} max={2.5} step={0.05} suffix="×" />
                <RangeRow label="结束倍率" field="footEndScale" value={tuning} onChange={setTuning} min={0.2} max={2.5} step={0.05} suffix="×" />
                <RangeRow label="左右错位" field="footSideOffset" value={tuning} onChange={setTuning} min={0} max={90} step={1} suffix="px" />
                <RangeRow label="脚步间距" field="footGap" value={tuning} onChange={setTuning} min={0.04} max={0.3} step={0.005} />
                <RangeRow label="停留时间" field="footLifetimeMs" value={tuning} onChange={setTuning} min={600} max={9000} step={100} suffix="ms" />
              </section>

              <section style={sectionStyle}>
                <strong style={{ fontSize: 12 }}>进入节奏</strong>
                <RangeRow label="行走时长" field="walkDurationMs" value={tuning} onChange={setTuning} min={1200} max={10000} step={100} suffix="ms" />
                <RangeRow label="循环停顿" field="cyclePauseMs" value={tuning} onChange={setTuning} min={0} max={5000} step={100} suffix="ms" />
              </section>

              <section style={sectionStyle}>
                <strong style={{ fontSize: 12 }}>魔法粒子</strong>
                <RangeRow label="粒子数量" field="particleCount" value={tuning} onChange={setTuning} min={0} max={80} step={1} />
                <RangeRow label="散开宽度" field="particleSpread" value={tuning} onChange={setTuning} min={4} max={100} step={1} suffix="px" />
                <RangeRow label="透明度" field="particleOpacity" value={tuning} onChange={setTuning} min={0.05} max={0.8} step={0.01} />
              </section>

              <section style={sectionStyle}>
                <strong style={{ fontSize: 12 }}>轨迹坐标</strong>
                <RangeRow label="Start X" field="startX" value={tuning} onChange={setTuning} min={0} max={HOME_SOURCE.width} step={1} />
                <RangeRow label="Start Y" field="startY" value={tuning} onChange={setTuning} min={0} max={HOME_SOURCE.height} step={1} />
                <RangeRow label="Curve1 X" field="control1X" value={tuning} onChange={setTuning} min={0} max={HOME_SOURCE.width} step={1} />
                <RangeRow label="Curve1 Y" field="control1Y" value={tuning} onChange={setTuning} min={0} max={HOME_SOURCE.height} step={1} />
                <RangeRow label="Curve2 X" field="control2X" value={tuning} onChange={setTuning} min={0} max={HOME_SOURCE.width} step={1} />
                <RangeRow label="Curve2 Y" field="control2Y" value={tuning} onChange={setTuning} min={0} max={HOME_SOURCE.height} step={1} />
                <RangeRow label="End X" field="endX" value={tuning} onChange={setTuning} min={0} max={HOME_SOURCE.width} step={1} />
                <RangeRow label="End Y" field="endY" value={tuning} onChange={setTuning} min={0} max={HOME_SOURCE.height} step={1} />
              </section>

              <div style={{ ...sectionStyle, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={buttonStyle} onClick={copySettings}>{copyStatus}</button>
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => {
                    setTuning(cloneRoadDefaults())
                    setActiveHandle('start')
                  }}
                >
                  恢复脚印默认
                </button>
              </div>
            </div>
          )}
        </aside>
      )}
    </>
  )
}
