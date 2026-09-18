import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import P5DreamLayer, {
  type DreamClipRect,
  type RenderedHomeRect,
} from './P5DreamLayer'
import TunePanel from './TunePanel'
import {
  ASSETS,
  HOME_ANCHORS,
  HOME_SOURCE,
  MAX_STAR_TRACKS,
  MOBILE_STAR_TUNING_DEFAULTS,
  MOTION,
  STAR_TUNING_DEFAULTS,
  type StarTrack,
  type StarTuning,
} from '../sceneConfig'

type Props = {
  onEnter: () => void
  mobile: boolean
  mobilePreview: boolean
}

type SceneState = 'idle' | 'awake' | 'entering'
type TuneHandleKind = 'spawn' | 'curve' | 'end'
type NumericTuningKey = Exclude<keyof StarTuning, 'tracks'>
type SourceSize = { width: number; height: number }

const DESKTOP_TUNING_STORAGE_KEY = 'pawcream-star-tuning-v3'
const MOBILE_TUNING_STORAGE_KEY = 'pawcream-star-tuning-mobile-v1'
const LEGACY_TUNING_STORAGE_KEYS = [
  'pawcream-star-tuning-v2',
  'pawcream-star-tuning-v1',
] as const

const NUMERIC_TUNING_KEYS: NumericTuningKey[] = [
  'spawnX',
  'spawnY',
  'sizeMin',
  'sizeMax',
  'pathDurationMs',
  'wobbleAmp',
  'wobbleFreq',
  'laneSpread',
  'spawnMinMs',
  'spawnMaxMs',
  'burstStars',
  'burstStaggerMs',
  'maxStars',
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function cloneDefaults(mobile = false): StarTuning {
  const defaults = mobile ? MOBILE_STAR_TUNING_DEFAULTS : STAR_TUNING_DEFAULTS
  return {
    ...defaults,
    tracks: defaults.tracks.map((track) => ({ ...track })),
  }
}

function readFiniteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readTrack(
  value: unknown,
  fallback: StarTrack,
  legacyBirthScale: number,
): StarTrack {
  const record = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}

  return {
    curveX: readFiniteNumber(record.curveX, fallback.curveX),
    curveY: readFiniteNumber(record.curveY, fallback.curveY),
    endX: readFiniteNumber(record.endX, fallback.endX),
    endY: readFiniteNumber(record.endY, fallback.endY),
    startScale: readFiniteNumber(record.startScale, legacyBirthScale),
    endScale: readFiniteNumber(record.endScale, fallback.endScale),
  }
}

function getContainRect(container: DOMRect, source: SourceSize): RenderedHomeRect {
  const safeWidth = Math.max(1, source.width)
  const safeHeight = Math.max(1, source.height)
  const sourceRatio = safeWidth / safeHeight
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
    sourceScale: width / safeWidth,
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

function normalizedDesktopPointToSource(
  point: { x: number; y: number },
  source: SourceSize,
) {
  return {
    x: source.width * (point.x / HOME_SOURCE.width),
    y: source.height * (point.y / HOME_SOURCE.height),
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

function loadStoredTuning(enabled: boolean, mobile: boolean): StarTuning {
  const defaults = mobile ? MOBILE_STAR_TUNING_DEFAULTS : STAR_TUNING_DEFAULTS

  if (!enabled || typeof window === 'undefined') {
    return cloneDefaults(mobile)
  }

  try {
    const storageKey = mobile
      ? MOBILE_TUNING_STORAGE_KEY
      : DESKTOP_TUNING_STORAGE_KEY
    let raw = window.localStorage.getItem(storageKey)

    if (!raw && !mobile) {
      for (const key of LEGACY_TUNING_STORAGE_KEYS) {
        raw = window.localStorage.getItem(key)
        if (raw) break
      }
    }

    if (!raw) return cloneDefaults(mobile)

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const next = cloneDefaults(mobile)

    for (const key of NUMERIC_TUNING_KEYS) {
      const candidate = parsed[key]
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        ;(next as unknown as Record<string, unknown>)[key] = candidate
      }
    }

    const legacyBirthScale = readFiniteNumber(parsed.birthScale, 0.38)

    if (Array.isArray(parsed.tracks) && parsed.tracks.length > 0) {
      next.tracks = parsed.tracks
        .slice(0, MAX_STAR_TRACKS)
        .map((track, index) => {
          const fallback = defaults.tracks[index] ?? defaults.tracks[0]
          return readTrack(track, fallback, legacyBirthScale)
        })
    } else {
      const first = next.tracks[0]
      next.tracks[0] = {
        curveX: readFiniteNumber(parsed.pathCurveX, first.curveX),
        curveY: readFiniteNumber(parsed.pathCurveY, first.curveY),
        endX: readFiniteNumber(parsed.pathEndX, first.endX),
        endY: readFiniteNumber(parsed.pathEndY, first.endY),
        startScale: legacyBirthScale,
        endScale: first.endScale,
      }
    }

    return next
  } catch {
    return cloneDefaults(mobile)
  }
}

export default function HomeScene({ onEnter, mobile, mobilePreview }: Props) {
  const artboardRef = useRef<HTMLDivElement | null>(null)
  const mobileScreenRef = useRef<HTMLDivElement | null>(null)
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
  const [mobileClipRect, setMobileClipRect] = useState<DreamClipRect | null>(null)
  const [transitionStartedAt, setTransitionStartedAt] = useState<number | null>(null)
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)
  const [sourceSize, setSourceSize] = useState<SourceSize>({ ...HOME_SOURCE })
  const [starTuning, setStarTuning] = useState<StarTuning>(() => loadStoredTuning(tuneMode, mobile))
  const [activeTrackIndex, setActiveTrackIndex] = useState(0)

  const entering = sceneState === 'entering'
  const awake = mobile || tuneMode || sceneState === 'awake' || entering
  const imageSrc = mobile ? ASSETS.homeMobile : ASSETS.home

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
      if (node) {
        setRenderedHomeRect(getContainRect(node.getBoundingClientRect(), sourceSize))
      }

      const screen = mobileScreenRef.current
      if (mobilePreview && screen) {
        const rect = screen.getBoundingClientRect()
        setMobileClipRect({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          radius: 46,
        })
      } else {
        setMobileClipRect(null)
      }
    }

    update()
    const observer = new ResizeObserver(update)
    if (artboardRef.current) observer.observe(artboardRef.current)
    if (mobileScreenRef.current) observer.observe(mobileScreenRef.current)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
    }
  }, [sourceSize, mobile, mobilePreview])

  useEffect(() => {
    if (mobile || !isCoarsePointer || entering || tuneMode) return
    const timer = window.setTimeout(() => {
      setSceneState((current) => (current === 'idle' ? 'awake' : current))
    }, MOTION.mobileAutoWakeMs)
    return () => window.clearTimeout(timer)
  }, [mobile, isCoarsePointer, entering, tuneMode])

  useEffect(() => {
    if (!tuneMode) return
    const storageKey = mobile
      ? MOBILE_TUNING_STORAGE_KEY
      : DESKTOP_TUNING_STORAGE_KEY
    window.localStorage.setItem(storageKey, JSON.stringify(starTuning))
  }, [starTuning, tuneMode, mobile])

  useEffect(() => {
    setActiveTrackIndex((current) =>
      Math.min(current, Math.max(0, starTuning.tracks.length - 1)),
    )
  }, [starTuning.tracks.length])

  const chimneySource = normalizedDesktopPointToSource(HOME_ANCHORS.chimney, sourceSize)
  const chimney = renderedHomeRect
    ? sourcePointToViewport(chimneySource, renderedHomeRect)
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
    if (entering) return
    setSceneState('entering')
    setTransitionStartedAt(performance.now())
    window.setTimeout(onEnter, MOTION.enterDurationMs)
  }

  const onPointerEnter = () => {
    if (!mobile && !entering) setSceneState('awake')
  }

  const onPointerLeave = () => {
    if (!mobile && !entering && !isCoarsePointer && !tuneMode) setSceneState('idle')
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

  const homeArtboard = (
    <div
      ref={artboardRef}
      className="home-artboard"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <img
        key={imageSrc}
        src={imageSrc}
        className="home-artwork"
        draggable={false}
        alt="PawCream dreamy illustrated atelier house"
        onLoad={(event) => {
          const image = event.currentTarget
          if (image.naturalWidth > 0 && image.naturalHeight > 0) {
            setSourceSize({ width: image.naturalWidth, height: image.naturalHeight })
          }
        }}
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
  )

  return (
    <main className={`home-scene home-scene--${sceneState}${mobile ? ' home-scene--mobile' : ''}${mobilePreview ? ' home-scene--mobile-preview' : ''}${tuneMode ? ' home-scene--tuning' : ''}`}>
      <P5DreamLayer
        awake={awake}
        entering={entering}
        transitionStartedAt={transitionStartedAt}
        homeRect={renderedHomeRect}
        chimney={chimney}
        tuning={starTuning}
        clipRect={mobilePreview ? mobileClipRect : null}
      />

      <div className="home-stage" aria-label="PawCream illustrated home">
        {mobilePreview ? (
          <div className="mobile-device-shell">
            <div className="mobile-reference-label" aria-hidden="true">
              Phone preview · 390 × 844 CSS px
            </div>
            <div ref={mobileScreenRef} className="mobile-device-screen">
              <div className="mobile-device-island" aria-hidden="true" />
              <div className="mobile-device-home-indicator" aria-hidden="true" />
              {homeArtboard}
            </div>
          </div>
        ) : homeArtboard}
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
