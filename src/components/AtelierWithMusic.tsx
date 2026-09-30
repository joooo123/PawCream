import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import AtelierWithSignin from './AtelierWithSignin'

type DeviceProfile = 'desktop' | 'mobile'
type Language = 'zh' | 'en'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

type RectSnapshot = {
  left: number
  top: number
  width: number
  height: number
}

type Flight = {
  oldIndex: number | null
  nextIndex: number
  player: RectSnapshot
  oldSlot: RectSnapshot | null
  newSlot: RectSnapshot
}

type MusicTune = {
  coneX: number
  coneY: number
  coneWidth: number
  discScale: number
  discX: number
  discY: number
  fontBoost: number
}

type MusicTuneProfiles = Record<DeviceProfile, MusicTune>

type RangeControlProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}

const BASE_URL = import.meta.env.BASE_URL
const LANGUAGE_STORAGE_KEY = 'pawcream-language-v1'
const MUSIC_TUNE_STORAGE_KEY = 'pawcream-music-tune-v1'
const MUSIC_ASSET_VERSION = '20260930-2'
const musicAsset = (name: string) =>
  `${BASE_URL}assets/music%20player/${encodeURIComponent(name)}?v=${MUSIC_ASSET_VERSION}`

const ICECREAM_BACK_URL = musicAsset('icecream back.png')
const ICECREAM_FRONT_URL = musicAsset('icecream front.png')
const CD_URLS = Array.from({ length: 9 }, (_, index) => musicAsset(`cd${index + 1}.png`))
const SWAP_DURATION_MS = 560

const uiFont = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const DEFAULT_TUNE: MusicTuneProfiles = {
  desktop: {
    coneX: 50,
    coneY: 52,
    coneWidth: 61,
    discScale: 58,
    discX: 50,
    discY: 17,
    fontBoost: 0,
  },
  mobile: {
    coneX: 50,
    coneY: 50,
    coneWidth: 72,
    discScale: 58,
    discX: 50,
    discY: 17,
    fontBoost: 0,
  },
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function readLanguage(): Language {
  if (typeof window === 'undefined') return 'zh'
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh'
}

function sanitizeTune(source: Partial<MusicTune> | undefined, fallback: MusicTune): MusicTune {
  return {
    coneX: clamp(Number(source?.coneX ?? fallback.coneX), 15, 85),
    coneY: clamp(Number(source?.coneY ?? fallback.coneY), 18, 82),
    coneWidth: clamp(Number(source?.coneWidth ?? fallback.coneWidth), 35, 200),
    discScale: clamp(Number(source?.discScale ?? fallback.discScale), 25, 95),
    discX: clamp(Number(source?.discX ?? fallback.discX), -20, 120),
    discY: clamp(Number(source?.discY ?? fallback.discY), -10, 55),
    fontBoost: clamp(Number(source?.fontBoost ?? fallback.fontBoost), -4, 16),
  }
}

function readTuneProfiles(): MusicTuneProfiles {
  if (typeof window === 'undefined') return DEFAULT_TUNE
  try {
    const raw = window.localStorage.getItem(MUSIC_TUNE_STORAGE_KEY)
    if (!raw) return DEFAULT_TUNE
    const parsed = JSON.parse(raw) as Partial<Record<DeviceProfile, Partial<MusicTune>>>
    return {
      desktop: sanitizeTune(parsed.desktop, DEFAULT_TUNE.desktop),
      mobile: sanitizeTune(parsed.mobile, DEFAULT_TUNE.mobile),
    }
  } catch {
    return DEFAULT_TUNE
  }
}

function snapshot(rect: DOMRect): RectSnapshot {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

function preload(src: string) {
  const image = new Image()
  image.decoding = 'async'
  image.src = src
}

function RangeControl({ label, value, min, max, step = 1, suffix = '', onChange }: RangeControlProps) {
  return (
    <label
      style={{
        display: 'grid',
        gridTemplateColumns: '86px 1fr 64px',
        gap: 8,
        alignItems: 'center',
        minHeight: 34,
        fontSize: 11,
      }}
    >
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        style={{ width: '100%', accentColor: '#8bb8d3', cursor: 'ew-resize' }}
      />
      <output style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64869c' }}>
        {Number.isInteger(value) ? value : value.toFixed(1)}{suffix}
      </output>
    </label>
  )
}

export default function AtelierWithMusic(props: Props) {
  const [open, setOpen] = useState(false)
  const [language, setLanguage] = useState<Language>(readLanguage)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [tuneProfiles, setTuneProfiles] = useState<MusicTuneProfiles>(readTuneProfiles)
  const [copyStatus, setCopyStatus] = useState('复制双端参数')

  const playerDiscRef = useRef<HTMLDivElement | null>(null)
  const slotRefs = useRef<Array<HTMLDivElement | null>>([])
  const oldFlightRef = useRef<HTMLImageElement | null>(null)
  const newFlightRef = useRef<HTMLImageElement | null>(null)

  const mobile = props.deviceProfile === 'mobile'
  const query = useMemo(
    () => typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search),
    [],
  )
  const tuneMode = query.get('tune') === '1'
  const musicPreviewMode = query.get('music') === '1'
  const musicTuneMode = query.get('musicTune') === '1'
  const tune = tuneProfiles[props.deviceProfile]

  const copy = language === 'zh'
    ? {
        title: "PawCream's Music Ice cream Shop",
        subtitle: '挑一个口味 ♡',
        current: '正在播放',
        ready: '请选择一张光碟',
        close: '关闭音乐播放器',
        choose: '选择光碟',
      }
    : {
        title: "PawCream's Music Ice cream Shop",
        subtitle: 'Pick a flavor ♡',
        current: 'Now playing',
        ready: 'Choose a disc',
        close: 'Close music player',
        choose: 'Choose disc',
      }

  useEffect(() => {
    preload(ICECREAM_BACK_URL)
    preload(ICECREAM_FRONT_URL)
    preload(CD_URLS[0])
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => CD_URLS.slice(1).forEach(preload), 80)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if ((musicPreviewMode || musicTuneMode) && !tuneMode) {
      setLanguage(readLanguage())
      setSelectedIndex(null)
      setOpen(true)
    }
  }, [musicPreviewMode, musicTuneMode, tuneMode])

  useEffect(() => {
    if (tuneMode) return

    const image = document.querySelector<HTMLImageElement>(
      'section[aria-label^="PawCream Atelier Room"] img[alt="Music"]',
    )
    const control = image?.parentElement
    if (!control) return

    const oldRole = control.getAttribute('role')
    const oldTabIndex = control.getAttribute('tabindex')
    const oldLabel = control.getAttribute('aria-label')
    const oldCursor = control.style.cursor

    control.setAttribute('role', 'button')
    control.setAttribute('tabindex', '0')
    control.setAttribute('aria-label', 'Music interaction')
    control.style.cursor = 'pointer'

    const openMusic = () => {
      setLanguage(readLanguage())
      setSelectedIndex(null)
      setFlight(null)
      setSwapping(false)
      setOpen(true)
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('[aria-label="Music interaction"]')) return
      event.preventDefault()
      event.stopPropagation()
      openMusic()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setSelectedIndex(null)
        setFlight(null)
        setSwapping(false)
        return
      }
      if (event.key !== 'Enter' && event.key !== ' ') return
      const target = event.target as Element | null
      if (!target?.closest('[aria-label="Music interaction"]')) return
      event.preventDefault()
      event.stopPropagation()
      openMusic()
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKeyDown, true)
      if (oldRole === null) control.removeAttribute('role')
      else control.setAttribute('role', oldRole)
      if (oldTabIndex === null) control.removeAttribute('tabindex')
      else control.setAttribute('tabindex', oldTabIndex)
      if (oldLabel === null) control.removeAttribute('aria-label')
      else control.setAttribute('aria-label', oldLabel)
      control.style.cursor = oldCursor
    }
  }, [props.deviceProfile, tuneMode])

  useLayoutEffect(() => {
    if (!flight) return

    const newDisc = newFlightRef.current
    if (!newDisc) return

    const timing: KeyframeAnimationOptions = {
      duration: SWAP_DURATION_MS,
      easing: 'cubic-bezier(.2,.78,.2,1)',
      fill: 'forwards',
    }

    if (flight.oldIndex !== null && flight.oldSlot && oldFlightRef.current) {
      oldFlightRef.current.animate(
        [
          {
            left: `${flight.player.left}px`,
            top: `${flight.player.top}px`,
            width: `${flight.player.width}px`,
            height: `${flight.player.height}px`,
            transform: 'rotate(0deg) scale(1)',
            opacity: 1,
          },
          {
            left: `${flight.oldSlot.left}px`,
            top: `${flight.oldSlot.top}px`,
            width: `${flight.oldSlot.width}px`,
            height: `${flight.oldSlot.height}px`,
            transform: 'rotate(-28deg) scale(.98)',
            opacity: 1,
          },
        ],
        timing,
      )
    }

    newDisc.animate(
      [
        {
          left: `${flight.newSlot.left}px`,
          top: `${flight.newSlot.top}px`,
          width: `${flight.newSlot.width}px`,
          height: `${flight.newSlot.height}px`,
          transform: 'rotate(18deg) scale(.98)',
          opacity: 1,
        },
        {
          left: `${flight.player.left}px`,
          top: `${flight.player.top}px`,
          width: `${flight.player.width}px`,
          height: `${flight.player.height}px`,
          transform: 'rotate(360deg) scale(1)',
          opacity: 1,
        },
      ],
      timing,
    )

    const timer = window.setTimeout(() => {
      setSelectedIndex(flight.nextIndex)
      setFlight(null)
      setSwapping(false)
    }, SWAP_DURATION_MS - 8)

    return () => window.clearTimeout(timer)
  }, [flight])

  const closePlayer = () => {
    setOpen(false)
    setSelectedIndex(null)
    setFlight(null)
    setSwapping(false)
  }

  const chooseDisc = (index: number) => {
    if (index === selectedIndex || swapping) return

    const playerRect = playerDiscRef.current?.getBoundingClientRect()
    const nextSlotRect = slotRefs.current[index]?.getBoundingClientRect()
    const oldSlotRect = selectedIndex === null
      ? null
      : slotRefs.current[selectedIndex]?.getBoundingClientRect() ?? null

    if (!playerRect || !nextSlotRect) {
      setSelectedIndex(index)
      return
    }

    setSwapping(true)
    setFlight({
      oldIndex: selectedIndex,
      nextIndex: index,
      player: snapshot(playerRect),
      oldSlot: oldSlotRect ? snapshot(oldSlotRect) : null,
      newSlot: snapshot(nextSlotRect),
    })
  }

  const updateTune = (patch: Partial<MusicTune>) => {
    setTuneProfiles((current) => {
      const next: MusicTuneProfiles = {
        ...current,
        [props.deviceProfile]: {
          ...current[props.deviceProfile],
          ...patch,
        },
      }
      window.localStorage.setItem(MUSIC_TUNE_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const resetCurrentTune = () => {
    setTuneProfiles((current) => {
      const next: MusicTuneProfiles = {
        ...current,
        [props.deviceProfile]: { ...DEFAULT_TUNE[props.deviceProfile] },
      }
      window.localStorage.setItem(MUSIC_TUNE_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const copyTuneParameters = async () => {
    const format = (profile: DeviceProfile) => {
      const value = tuneProfiles[profile]
      return `${profile}: coneX=${value.coneX}%, coneY=${value.coneY}%, coneWidth=${value.coneWidth}%, discScale=${value.discScale}%, discX=${value.discX}%, discY=${value.discY}%, fontBoost=${value.fontBoost >= 0 ? '+' : ''}${value.fontBoost}px`
    }
    const text = ['PawCream Music Tune', format('desktop'), format('mobile')].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('已复制')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
      setCopyStatus('已复制')
    }
    window.setTimeout(() => setCopyStatus('复制双端参数'), 1300)
  }

  const panelStyle: CSSProperties = {
    position: 'relative',
    width: mobile ? 'min(390px, calc(100vw - 14px))' : 'min(1120px, calc(100vw - 34px))',
    height: mobile ? 'min(820px, calc(100svh - 14px))' : 'min(760px, calc(100svh - 38px))',
    maxHeight: 'calc(100svh - 14px)',
    border: '1px solid rgba(172, 205, 226, .72)',
    borderRadius: mobile ? 26 : 30,
    background: 'rgba(236, 247, 253, .91)',
    boxShadow: '0 24px 70px rgba(74, 111, 137, .20), inset 0 1px 0 rgba(255,255,255,.94)',
    backdropFilter: 'blur(24px) saturate(.9)',
    WebkitBackdropFilter: 'blur(24px) saturate(.9)',
    overflow: mobile ? 'auto' : 'hidden',
    color: '#6689a3',
    fontFamily: uiFont,
  }

  const cabinetStyle: CSSProperties = {
    position: 'relative',
    border: '1px solid rgba(158, 198, 223, .72)',
    borderRadius: mobile ? 20 : 24,
    background: 'rgba(245, 251, 255, .76)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.96), 0 14px 34px rgba(97, 141, 170, .10)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  }

  return (
    <>
      <AtelierWithSignin {...props} />

      {open && !tuneMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={copy.title}
          className="pawcream-music-overlay"
          onClick={(event) => event.stopPropagation()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            display: 'grid',
            placeItems: 'center',
            padding: mobile ? 7 : 18,
            boxSizing: 'border-box',
            background: 'rgba(207, 231, 246, .62)',
            backdropFilter: 'blur(16px) saturate(.88)',
            WebkitBackdropFilter: 'blur(16px) saturate(.88)',
          }}
        >
          <style>{`
            @keyframes pawcream-music-overlay-in {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes pawcream-music-panel-in {
              from { opacity: 0; transform: translateY(16px) scale(.985); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes pawcream-music-spin {
              to { transform: rotate(360deg); }
            }
            .pawcream-music-overlay {
              animation: pawcream-music-overlay-in 220ms ease-out both;
            }
            .pawcream-music-panel {
              animation: pawcream-music-panel-in 300ms cubic-bezier(.2,.82,.24,1) both;
            }
            .pawcream-music-current-disc {
              animation: pawcream-music-spin 10s linear infinite;
              transform-origin: 50% 50%;
            }
            .pawcream-music-slot-button:hover .pawcream-music-slot-disc {
              transform: translateY(-4px) rotate(-3deg) scale(1.045);
              filter: drop-shadow(0 9px 12px rgba(89, 124, 147, .18));
            }
            .pawcream-music-slot-button:focus-visible {
              outline: 2px solid rgba(111, 163, 197, .78);
              outline-offset: 3px;
            }
            @media (prefers-reduced-motion: reduce) {
              .pawcream-music-overlay,
              .pawcream-music-panel,
              .pawcream-music-current-disc {
                animation: none !important;
              }
            }
          `}</style>

          <div className="pawcream-music-panel" style={panelStyle}>
            <button
              type="button"
              aria-label={copy.close}
              onClick={closePlayer}
              style={{
                position: 'absolute',
                right: mobile ? 16 : 22,
                top: mobile ? 15 : 20,
                zIndex: 8,
                width: mobile ? 38 : 42,
                height: mobile ? 38 : 42,
                border: '1px solid rgba(158, 198, 223, .72)',
                borderRadius: '50%',
                background: 'rgba(255,255,255,.78)',
                color: '#6d91aa',
                boxShadow: '0 8px 20px rgba(95, 134, 159, .12)',
                fontSize: mobile ? 26 : 29,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ×
            </button>

            <header
              style={{
                position: mobile ? 'relative' : 'absolute',
                left: mobile ? undefined : 32,
                top: mobile ? undefined : 25,
                padding: mobile ? '22px 64px 4px 22px' : 0,
                zIndex: 5,
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontSize: (mobile ? 19 : 24) + tune.fontBoost, fontWeight: 650, letterSpacing: '.035em' }}>
                {copy.title}
              </div>
              <div style={{ marginTop: 5, fontSize: (mobile ? 11 : 13) + tune.fontBoost, opacity: .72, letterSpacing: '.08em' }}>
                {selectedIndex === null
                  ? copy.ready
                  : `${copy.current} · ${String(selectedIndex + 1).padStart(2, '0')} / ${String(CD_URLS.length).padStart(2, '0')}`}
              </div>
            </header>

            <div
              style={{
                display: mobile ? 'flex' : 'grid',
                flexDirection: mobile ? 'column' : undefined,
                gridTemplateColumns: mobile ? undefined : '1.35fr .9fr',
                gap: mobile ? 8 : 24,
                alignItems: mobile ? 'center' : 'stretch',
                height: mobile ? 'auto' : '100%',
                boxSizing: 'border-box',
                padding: mobile ? '0 13px 18px' : '78px 28px 26px 32px',
              }}
            >
              <section
                aria-label="Current music disc"
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: mobile ? 398 : 0,
                  overflow: 'visible',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: `${tune.coneX}%`,
                    top: `${tune.coneY}%`,
                    width: `${tune.coneWidth}%`,
                    aspectRatio: '2 / 3',
                    transform: 'translate(-50%, -50%)',
                    filter: 'drop-shadow(0 20px 24px rgba(103, 132, 147, .13))',
                  }}
                >
                  <img
                    src={ICECREAM_BACK_URL}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    decoding="async"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      zIndex: 1,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  />

                  <div
                    ref={playerDiscRef}
                    style={{
                      position: 'absolute',
                      left: `${tune.discX}%`,
                      top: `${tune.discY}%`,
                      width: `${tune.discScale}%`,
                      aspectRatio: '1',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 2,
                      opacity: flight ? 0 : 1,
                      pointerEvents: 'none',
                    }}
                  >
                    {selectedIndex !== null && (
                      <img
                        className="pawcream-music-current-disc"
                        src={CD_URLS[selectedIndex]}
                        alt={`CD ${selectedIndex + 1}`}
                        draggable={false}
                        decoding="async"
                        style={{
                          display: 'block',
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          userSelect: 'none',
                          filter: 'drop-shadow(0 10px 14px rgba(65, 91, 109, .18))',
                        }}
                      />
                    )}
                  </div>

                  <img
                    src={ICECREAM_FRONT_URL}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    decoding="async"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      zIndex: 3,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  />
                </div>
              </section>

              <aside
                aria-label={copy.choose}
                style={{
                  ...cabinetStyle,
                  width: '100%',
                  alignSelf: 'center',
                  padding: mobile ? '12px 10px 11px' : '18px 16px 16px',
                  boxSizing: 'border-box',
                  maxWidth: mobile ? 350 : 410,
                }}
              >
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: (mobile ? 14 : 17) + tune.fontBoost,
                    fontWeight: 600,
                    letterSpacing: '.055em',
                    marginBottom: mobile ? 9 : 14,
                    color: '#6b8fa8',
                  }}
                >
                  {copy.subtitle}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: mobile ? 7 : 10,
                  }}
                >
                  {CD_URLS.map((src, index) => {
                    const selected = selectedIndex !== null && index === selectedIndex
                    const flyingOut = flight?.nextIndex === index
                    return (
                      <button
                        key={src}
                        type="button"
                        className="pawcream-music-slot-button"
                        aria-label={`${copy.choose} ${index + 1}`}
                        aria-pressed={selected}
                        disabled={swapping}
                        onClick={() => chooseDisc(index)}
                        style={{
                          position: 'relative',
                          border: '1px solid rgba(177, 204, 221, .56)',
                          borderRadius: mobile ? 13 : 15,
                          background: selected ? 'rgba(229,241,249,.46)' : 'rgba(255,253,247,.78)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9), 0 5px 13px rgba(96,130,151,.08)',
                          padding: mobile ? 5 : 7,
                          cursor: selected || swapping ? 'default' : 'pointer',
                          aspectRatio: '1',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          ref={(node) => { slotRefs.current[index] = node }}
                          style={{
                            position: 'absolute',
                            inset: mobile ? 6 : 8,
                            borderRadius: '50%',
                          }}
                        >
                          {!selected && !flyingOut && (
                            <img
                              className="pawcream-music-slot-disc"
                              src={src}
                              alt=""
                              aria-hidden="true"
                              draggable={false}
                              decoding="async"
                              style={{
                                display: 'block',
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                transition: 'transform 180ms ease, filter 180ms ease',
                                userSelect: 'none',
                              }}
                            />
                          )}
                          {selected && (
                            <div
                              aria-hidden="true"
                              style={{
                                position: 'absolute',
                                inset: '10%',
                                borderRadius: '50%',
                                border: '1px dashed rgba(143, 184, 210, .42)',
                                background: 'rgba(211,232,245,.18)',
                              }}
                            />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </aside>
            </div>
          </div>

          {flight && (
            <>
              {flight.oldIndex !== null && (
                <img
                  ref={oldFlightRef}
                  src={CD_URLS[flight.oldIndex]}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  style={{
                    position: 'fixed',
                    left: flight.player.left,
                    top: flight.player.top,
                    width: flight.player.width,
                    height: flight.player.height,
                    objectFit: 'contain',
                    zIndex: 120,
                    pointerEvents: 'none',
                    filter: 'drop-shadow(0 10px 14px rgba(66,95,114,.19))',
                  }}
                />
              )}
              <img
                ref={newFlightRef}
                src={CD_URLS[flight.nextIndex]}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                  position: 'fixed',
                  left: flight.newSlot.left,
                  top: flight.newSlot.top,
                  width: flight.newSlot.width,
                  height: flight.newSlot.height,
                  objectFit: 'contain',
                  zIndex: 121,
                  pointerEvents: 'none',
                  filter: 'drop-shadow(0 10px 14px rgba(66,95,114,.19))',
                }}
              />
            </>
          )}

          {musicTuneMode && (
            <aside
              aria-label="PawCream Music tune panel"
              style={{
                position: 'fixed',
                right: 12,
                top: 12,
                zIndex: 160,
                width: 'min(340px, calc(100vw - 24px))',
                maxHeight: 'calc(100svh - 24px)',
                overflow: 'auto',
                boxSizing: 'border-box',
                padding: 14,
                border: '1px solid rgba(151, 194, 220, .72)',
                borderRadius: 18,
                background: 'rgba(242, 250, 255, .94)',
                boxShadow: '0 18px 48px rgba(78, 118, 145, .18)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                color: '#587d96',
                fontFamily: uiFont,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Music 调试面板</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 12 }}>
                {(['desktop', 'mobile'] as DeviceProfile[]).map((profile) => (
                  <button
                    key={profile}
                    type="button"
                    onClick={() => props.onDeviceChange(profile)}
                    style={{
                      height: 32,
                      border: '1px solid rgba(151,194,220,.66)',
                      borderRadius: 10,
                      background: props.deviceProfile === profile ? 'rgba(204,229,244,.92)' : 'rgba(255,255,255,.72)',
                      color: '#5d8199',
                      cursor: 'pointer',
                      fontFamily: uiFont,
                    }}
                  >
                    {profile === 'desktop' ? '电脑端' : '手机端'}
                  </button>
                ))}
              </div>

              <RangeControl label="冰淇淋 X" value={tune.coneX} min={15} max={85} step={0.5} suffix="%" onChange={(value) => updateTune({ coneX: value })} />
              <RangeControl label="冰淇淋 Y" value={tune.coneY} min={18} max={82} step={0.5} suffix="%" onChange={(value) => updateTune({ coneY: value })} />
              <RangeControl label="冰淇淋大小" value={tune.coneWidth} min={35} max={200} step={0.5} suffix="%" onChange={(value) => updateTune({ coneWidth: value })} />
              <RangeControl label="唱片大小" value={tune.discScale} min={25} max={95} step={0.5} suffix="%" onChange={(value) => updateTune({ discScale: value })} />
              <RangeControl label="唱片左右" value={tune.discX} min={-20} max={120} step={0.5} suffix="%" onChange={(value) => updateTune({ discX: value })} />
              <RangeControl label="唱片上下" value={tune.discY} min={-10} max={55} step={0.5} suffix="%" onChange={(value) => updateTune({ discY: value })} />
              <RangeControl label="字体大小" value={tune.fontBoost} min={-4} max={16} step={1} suffix="px" onChange={(value) => updateTune({ fontBoost: value })} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={resetCurrentTune}
                  style={{
                    minHeight: 34,
                    border: '1px solid rgba(151,194,220,.66)',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,.76)',
                    color: '#5d8199',
                    cursor: 'pointer',
                  }}
                >
                  重置当前端
                </button>
                <button
                  type="button"
                  onClick={copyTuneParameters}
                  style={{
                    minHeight: 34,
                    border: '1px solid rgba(151,194,220,.66)',
                    borderRadius: 10,
                    background: 'rgba(214,234,246,.88)',
                    color: '#52758d',
                    cursor: 'pointer',
                  }}
                >
                  {copyStatus}
                </button>
              </div>
            </aside>
          )}
        </div>
      )}
    </>
  )
}
