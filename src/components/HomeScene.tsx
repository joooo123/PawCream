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
  MAX_STAR_TRACKS,
  MOTION,
  STAR_TUNING_DEFAULTS,
  type StarTrack,
  type StarTuning,
} from '../sceneConfig'

type Props = {
  onEnter: () => void
}

type SceneState = 'idle' | 'awake' | 'entering'
type TuneHandleKind = 'spawn' | 'curve' | 'end'
type NumericTuningKey = Exclude<keyof StarTuning, 'tracks'>

const TUNING_STORAGE_KEY = 'pawcream-star-tuning-v2'
const LEGACY_TUNING_STORAGE_KEY = 'pawcream-star-tuning-v1'

const NUMERIC_TUNING_KEYS: NumericTuningKey[] = [
  'spawnX',
  'spawnY',
  'sizeMin',
  'sizeMax',
  'birthScale',
  'pathDurationMs',
  'wobbleAmp',
  'wobbleFreq',
  'laneSpread',
  'spawnMinMs',
  'spawnMaxMs',
  'maxStars',
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function cloneDefaults(): StarTuning {
  return {
    ...STAR_TUNING_DEFAULTS,
    tracks: STAR_TUNING_DEFAULTS.tracks.map((track) => ({ ...track })),
  }
}

function readFiniteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readTrack(value: unknown, fallback: StarTrack): StarTrack {
  const record = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}

  return {
    curveX: readFiniteNumber(record.curveX, fallback.curveX),
    curveY: readFiniteNumber(record.curveY, fallback.curveY),
    endX: readFiniteNumber(record.endX, fallback.endX),
    endY: readFiniteNumber(record.endY, fallback.endY),
  }
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
    return cloneDefaults()
  }

  try {
    const raw =
      window.localStorage.getItem(TUNING_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_TUNING_STORAGE_KEY)
    if (!raw) return cloneDefaults()

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const next = cloneDefaults()

    for (const key of NUMERIC_TUNING_KEYS) {
      const candidate = parsed[key]
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        ;(next as unknown as Record<string, unknown>)[key] = candidate
      }
    }

    if (Array.isArray(parsed.tracks) && parsed.tracks.length > 0) {
      next.tracks = parsed.tracks
        .slice(0, MAX_STAR_TRACKS)
        .map((track, index) => {
          const fallback =
            STAR_TUNING_DEFAULTS.tracks[index] ??
            STAR_TUNING_DEFAULTS.tracks[0]
          return readTrack(track, fallback)
        })
    } else {
      // Migrate the original single-trajectory tune data into track 1 while
      // keeping the new default tracks 2 and 3 available for comparison.
      const first = next.tracks[0]
      next.tracks[0] = {
        curveX: readFiniteNumber(parsed.pathCurveX, first.curveX),
        curveY: readFiniteNumber(parsed.pathCurveY, first.curveY),
        endX: readFiniteNumber(parsed.pathEndX, first.endX),
        endY: readFiniteNumber(parsed.pathEndY, first.endY),
      }
    }

    return next
  } catch {
    return cloneDefaults()
  }
}

export default function HomeScene({ onEnter }: Props) {
  const artboardRef = useRef<HTMLDivElement | null>(null)
  const dragHandleRef = useRef<{
    kind: TuneHandleKind
    trackIndex: number
    pointerId: number
  } | null>(null)
  const tuneMode = useMemo(
    () => new URLSearchParams(window.location.search).get('tune') === '1',
    [],
  )

  const [sceneState, setSceneState] = useState<SceneState>('idle')
  const [renderedHomeRect, setRenderedHomeRect] = useState<RenderedHomeRect | null>(null)
  const [transitionStartedAt, setTransitionStartedAt] = useState<number | null>(null)
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)
  const [starTuning, setStarTuning] = useState<StarTuning>(() => loadStoredTuning(tuneMode))
  const [activeTrackIndex, setActiveTrackIndex] = useState(0)

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

  useEffect(() => {
    setActiveTrackIndex((current) =>
      Math.min(current, Math.max(0, starTuning.tracks.length - 1)),
    )
  }, [starTuning.tracks.length])

  const chimney = renderedHomeRect
    ? sourcePointToViewport(HOME_ANCHORS.chimney, renderedHomeRect)
    : null

  const tuneSpawnPoint = chimney
    ? {
        x: chimney.x + starTuning.spawnX,
        y: chimney.y + starTuning.spawnY,
      }
    : null

  const tuneTrackPoints = tuneSpawnPoint
    ? starTuning.tracks.map((track) => ({
        curve: {
          x: tuneSpawnPoint.x + track.curveX,
          y: tuneSpawnPoint.y + track.curveY,
        },
        end: {
          x: tuneSpawnPoint.x + track.endX,
          y: tuneSpawnPoint.y + track.endY,
        },
      }))
    : []

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

  const updateTuneHandleFromPointer = (
    kind: TuneHandleKind,
    trackIndex: number,
    clientX: number,
    clientY: number,
  ) => {
    if (!chimney) return

    setStarTuning((current) => {
      if (kind === 'spawn') {
        return {
          ...current,
          spawnX: clamp(Math.round(clientX - chimney.x), -80, 140),
          spawnY: clamp(Math.round(clientY - chimney.y), -80, 120),
        }
      }

      const spawnX = chimney.x + current.spawnX
      const spawnY = chimney.y + current.spawnY
      const nextTracks = current.tracks.map((track) => ({ ...track }))
      const track = nextTracks[trackIndex]
      if (!track) return current

      if (kind === 'curve') {
        track.curveX = clamp(Math.round(clientX - spawnX), -120, 420)
        track.curveY = clamp(Math.round(clientY - spawnY), -360, 220)
      } else {
        track.endX = clamp(Math.round(clientX - spawnX), 40, 520)
        track.endY = clamp(Math.round(clientY - spawnY), -360, 180)
      }

      return { ...current, tracks: nextTracks }
    })
  }

  const onTuneHandlePointerDown = (
    kind: TuneHandleKind,
    trackIndex: number,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (kind !== 'spawn') setActiveTrackIndex(trackIndex)
    dragHandleRef.current = { kind, trackIndex, pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
    updateTuneHandleFromPointer(kind, trackIndex, event.clientX, event.clientY)
  }

  const onTuneHandlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = dragHandleRef.current
    if (!active || active.pointerId !== event.pointerId) return
    updateTuneHandleFromPointer(
      active.kind,
      active.trackIndex,
      event.clientX,
      event.clientY,
    )
  }

  const onTuneHandlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = dragHandleRef.current
    if (!active || active.pointerId !== event.pointerId) return
    dragHandleRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const renderTuneHandle = (
    kind: TuneHandleKind,
    trackIndex: number,
    point: { x: number; y: number },
    label: string,
    isActive: boolean,
  ) => (
    <button
      key={`${kind}-${trackIndex}`}
      type="button"
      className={[
        'tune-path-handle',
        `tune-path-handle--${kind}`,
        kind === 'spawn' ? '' : `tune-track-color--${trackIndex % 6}`,
        isActive ? 'is-active' : '',
      ].filter(Boolean).join(' ')}
      style={{ left: point.x, top: point.y }}
      aria-label={`${label} X ${Math.round(point.x)}, Y ${Math.round(point.y)}`}
      onPointerDown={(event) => onTuneHandlePointerDown(kind, trackIndex, event)}
      onPointerMove={onTuneHandlePointerMove}
      onPointerUp={onTuneHandlePointerUp}
      onPointerCancel={onTuneHandlePointerUp}
    >
      <span>{label}</span>
    </button>
  )

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

      {tuneMode && tuneSpawnPoint && tuneTrackPoints.length > 0 && (
        <>
          <svg className="tune-path-overlay" aria-hidden="true">
            {tuneTrackPoints.map((points, index) => {
              const active = index === activeTrackIndex
              return (
                <g
                  key={index}
                  className={`tune-track-group tune-track-color--${index % 6}${active ? ' is-active' : ''}`}
                >
                  <line
                    className="tune-path-control-line"
                    x1={tuneSpawnPoint.x}
                    y1={tuneSpawnPoint.y}
                    x2={points.curve.x}
                    y2={points.curve.y}
                  />
                  <line
                    className="tune-path-control-line"
                    x1={points.curve.x}
                    y1={points.curve.y}
                    x2={points.end.x}
                    y2={points.end.y}
                  />
                  <path
                    className="tune-path-curve"
                    d={`M ${tuneSpawnPoint.x} ${tuneSpawnPoint.y} Q ${points.curve.x} ${points.curve.y} ${points.end.x} ${points.end.y}`}
                  />
                </g>
              )
            })}
          </svg>

          {renderTuneHandle('spawn', activeTrackIndex, tuneSpawnPoint, 'spawn', true)}
          {tuneTrackPoints.flatMap((points, index) => {
            const active = index === activeTrackIndex
            return [
              renderTuneHandle('curve', index, points.curve, `curve ${index + 1}`, active),
              renderTuneHandle('end', index, points.end, `end ${index + 1}`, active),
            ]
          })}
        </>
      )}

      {tuneMode && (
        <TunePanel
          value={starTuning}
          onChange={setStarTuning}
          activeTrackIndex={activeTrackIndex}
          onActiveTrackChange={setActiveTrackIndex}
        />
      )}
    </main>
  )
}
