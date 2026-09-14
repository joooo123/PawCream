import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import P5DreamLayer, { type RenderedHomeRect } from './P5DreamLayer'
import TunePanel from './TunePanel'
import {
  ASSETS,
  HOME_ANCHORS,
  HOME_SOURCE,
  MOTION,
  STAR_TUNING_DEFAULTS,
  type StarTuning,
} from '../sceneConfig'

type Props = {
  onEnter: () => void
}

type SceneState = 'idle' | 'awake' | 'entering'

const TUNING_STORAGE_KEY = 'pawcream-star-tuning-v1'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getContainRect(container: DOMRect): RenderedHomeRect {
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

  const left = container.left + (container.width - width) / 2
  const top = container.top + (container.height - height) / 2

  return {
    left,
    top,
    width,
    height,
    sourceScale: width / HOME_SOURCE.width,
  }
}

function sourcePointToViewport(
  point: { x: number; y: number },
  rect: RenderedHomeRect,
) {
  return {
    x: rect.left + point.x * rect.sourceScale,
    y: rect.top + point.y * rect.sourceScale,
  }
}

function sourceRectToPercent() {
  return {
    left: `${(HOME_ANCHORS.houseHotspot.x / HOME_SOURCE.width) * 100}%`,
    top: `${(HOME_ANCHORS.houseHotspot.y / HOME_SOURCE.height) * 100}%`,
    width: `${(HOME_ANCHORS.houseHotspot.width / HOME_SOURCE.width) * 100}%`,
    height: `${(HOME_ANCHORS.houseHotspot.height / HOME_SOURCE.height) * 100}%`,
  }
}

function loadStoredTuning(enabled: boolean): StarTuning {
  if (!enabled || typeof window === 'undefined') {
    return { ...STAR_TUNING_DEFAULTS }
  }

  try {
    const raw = window.localStorage.getItem(TUNING_STORAGE_KEY)
    if (!raw) return { ...STAR_TUNING_DEFAULTS }

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const next = { ...STAR_TUNING_DEFAULTS }

    for (const key of Object.keys(STAR_TUNING_DEFAULTS) as (keyof StarTuning)[]) {
      const candidate = parsed[key]
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        next[key] = candidate
      }
    }

    return next
  } catch {
    return { ...STAR_TUNING_DEFAULTS }
  }
}

export default function HomeScene({ onEnter }: Props) {
  const artboardRef = useRef<HTMLDivElement | null>(null)
  const dragPointerIdRef = useRef<number | null>(null)
  const tuneMode = useMemo(
    () => new URLSearchParams(window.location.search).get('tune') === '1',
    [],
  )

  const [sceneState, setSceneState] = useState<SceneState>('idle')
  const [renderedHomeRect, setRenderedHomeRect] = useState<RenderedHomeRect | null>(null)
  const [transitionStartedAt, setTransitionStartedAt] = useState<number | null>(null)
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)
  const [starTuning, setStarTuning] = useState<StarTuning>(() => loadStoredTuning(tuneMode))

  const entering = sceneState === 'entering'
  const awake = tuneMode || sceneState === 'awake' || entering

  const hotspotStyle = useMemo(() => sourceRectToPercent(), [])

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)')
    const update = () => setIsCoarsePointer(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    const update = () => {
      const node = artboardRef.current
      if (!node) return
      setRenderedHomeRect(getContainRect(node.getBoundingClientRect()))
    }

    update()
    const observer = new ResizeObserver(update)
    if (artboardRef.current) observer.observe(artboardRef.current)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
    }
  }, [])

  useEffect(() => {
    if (!isCoarsePointer || entering || tuneMode) return
    const timer = window.setTimeout(() => {
      setSceneState((current) => (current === 'idle' ? 'awake' : current))
    }, MOTION.mobileAutoWakeMs)
    return () => window.clearTimeout(timer)
  }, [isCoarsePointer, entering, tuneMode])

  useEffect(() => {
    if (!tuneMode) return
    window.localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(starTuning))
  }, [starTuning, tuneMode])

  const chimney = renderedHomeRect
    ? sourcePointToViewport(HOME_ANCHORS.chimney, renderedHomeRect)
    : null

  const tuneSpawnPoint = chimney
    ? {
        x: chimney.x + starTuning.spawnX,
        y: chimney.y + starTuning.spawnY,
      }
    : null

  const beginEnter = () => {
    if (entering || tuneMode) return
    setSceneState('entering')
    setTransitionStartedAt(performance.now())
    window.setTimeout(onEnter, MOTION.enterDurationMs)
  }

  const onPointerEnter = () => {
    if (!entering) setSceneState('awake')
  }

  const onPointerLeave = () => {
    if (!entering && !isCoarsePointer && !tuneMode) setSceneState('idle')
  }

  const updateSpawnFromPointer = (clientX: number, clientY: number) => {
    if (!chimney) return

    setStarTuning((current) => ({
      ...current,
      spawnX: clamp(Math.round(clientX - chimney.x), -80, 140),
      spawnY: clamp(Math.round(clientY - chimney.y), -80, 120),
    }))
  }

  const onTuneHandlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragPointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    updateSpawnFromPointer(event.clientX, event.clientY)
  }

  const onTuneHandlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) return
    updateSpawnFromPointer(event.clientX, event.clientY)
  }

  const onTuneHandlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) return
    dragPointerIdRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <main className={`home-scene home-scene--${sceneState}${tuneMode ? ' home-scene--tuning' : ''}`}>
      <P5DreamLayer
        awake={awake}
        entering={entering}
        transitionStartedAt={transitionStartedAt}
        homeRect={renderedHomeRect}
        chimney={chimney}
        tuning={starTuning}
      />

      <div className="home-stage" aria-label="PawCream illustrated home">
        <div
          ref={artboardRef}
          className="home-artboard"
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
        >
          <img
            src={ASSETS.home}
            className="home-artwork"
            draggable={false}
            alt="PawCream dreamy illustrated atelier house"
          />

          <button
            className="house-hotspot"
            style={hotspotStyle}
            type="button"
            aria-label="Enter PawCream atelier"
            onFocus={onPointerEnter}
            onBlur={onPointerLeave}
            onClick={beginEnter}
          >
            <span className="sr-only">Enter PawCream atelier</span>
          </button>
        </div>
      </div>

      {tuneMode && tuneSpawnPoint && (
        <button
          type="button"
          className="tune-spawn-handle"
          style={{ left: tuneSpawnPoint.x, top: tuneSpawnPoint.y }}
          aria-label={`星星出生点 X ${starTuning.spawnX}, Y ${starTuning.spawnY}`}
          onPointerDown={onTuneHandlePointerDown}
          onPointerMove={onTuneHandlePointerMove}
          onPointerUp={onTuneHandlePointerUp}
          onPointerCancel={onTuneHandlePointerUp}
        >
          <span>spawn</span>
        </button>
      )}

      {tuneMode && (
        <TunePanel
          value={starTuning}
          onChange={setStarTuning}
        />
      )}
    </main>
  )
}
