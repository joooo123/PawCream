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
  oldIndex: number
  nextIndex: number
  player: RectSnapshot
  oldSlot: RectSnapshot
  newSlot: RectSnapshot
}

const BASE_URL = import.meta.env.BASE_URL
const LANGUAGE_STORAGE_KEY = 'pawcream-language-v1'
const MUSIC_ASSET_VERSION = '20260930-1'
const musicAsset = (name: string) =>
  `${BASE_URL}assets/music%20player/${encodeURIComponent(name)}?v=${MUSIC_ASSET_VERSION}`

const ICECREAM_BACK_URL = musicAsset('icecream back.png')
const ICECREAM_FRONT_URL = musicAsset('icecream front.png')
const CD_URLS = Array.from({ length: 9 }, (_, index) => musicAsset(`cd${index + 1}.png`))
const SWAP_DURATION_MS = 560

const uiFont = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

function readLanguage(): Language {
  if (typeof window === 'undefined') return 'zh'
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh'
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

export default function AtelierWithMusic(props: Props) {
  const [open, setOpen] = useState(false)
  const [language, setLanguage] = useState<Language>(readLanguage)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [swapping, setSwapping] = useState(false)

  const playerDiscRef = useRef<HTMLDivElement | null>(null)
  const slotRefs = useRef<Array<HTMLDivElement | null>>([])
  const oldFlightRef = useRef<HTMLImageElement | null>(null)
  const newFlightRef = useRef<HTMLImageElement | null>(null)

  const mobile = props.deviceProfile === 'mobile'
  const tuneMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tune') === '1',
    [],
  )
  const musicPreviewMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('music') === '1',
    [],
  )

  const copy = language === 'zh'
    ? {
        title: 'PawCream 音乐冰淇淋',
        subtitle: '挑一个口味 ♡',
        current: '正在播放',
        close: '关闭音乐播放器',
        choose: '选择光碟',
      }
    : {
        title: 'PawCream Music Ice Cream',
        subtitle: 'Pick a flavor ♡',
        current: 'Now playing',
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
    const timer = window.setTimeout(() => {
      CD_URLS.slice(1).forEach(preload)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (musicPreviewMode && !tuneMode) {
      setLanguage(readLanguage())
      setOpen(true)
    }
  }, [musicPreviewMode, tuneMode])

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

    const oldDisc = oldFlightRef.current
    const newDisc = newFlightRef.current
    if (!oldDisc || !newDisc) return

    const timing: KeyframeAnimationOptions = {
      duration: SWAP_DURATION_MS,
      easing: 'cubic-bezier(.2,.78,.2,1)',
      fill: 'forwards',
    }

    oldDisc.animate(
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
    setFlight(null)
    setSwapping(false)
  }

  const chooseDisc = (index: number) => {
    if (index === selectedIndex || swapping) return

    const playerRect = playerDiscRef.current?.getBoundingClientRect()
    const nextSlotRect = slotRefs.current[index]?.getBoundingClientRect()
    const oldSlotRect = slotRefs.current[selectedIndex]?.getBoundingClientRect()

    if (!playerRect || !nextSlotRect || !oldSlotRect) {
      setSelectedIndex(index)
      return
    }

    setSwapping(true)
    setFlight({
      oldIndex: selectedIndex,
      nextIndex: index,
      player: snapshot(playerRect),
      oldSlot: snapshot(oldSlotRect),
      newSlot: snapshot(nextSlotRect),
    })
  }

  const panelStyle: CSSProperties = {
    position: 'relative',
    width: mobile ? 'min(390px, calc(100vw - 14px))' : 'min(1120px, calc(100vw - 34px))',
    height: mobile ? 'min(820px, calc(100svh - 14px))' : 'min(760px, calc(100svh - 38px))',
    maxHeight: 'calc(100svh - 14px)',
    border: '1px solid rgba(172, 205, 226, .72)',
    borderRadius: mobile ? 26 : 30,
    background: 'radial-gradient(circle at 34px 30px, rgba(210,231,245,.53) 0 15px, transparent 16px) 0 0 / 138px 96px, rgba(251,253,255,.89)',
    boxShadow: '0 24px 70px rgba(74, 111, 137, .22), inset 0 1px 0 rgba(255,255,255,.92)',
    backdropFilter: 'blur(24px) saturate(.92)',
    WebkitBackdropFilter: 'blur(24px) saturate(.92)',
    overflow: mobile ? 'auto' : 'hidden',
    color: '#6689a3',
    fontFamily: uiFont,
  }

  const cabinetStyle: CSSProperties = {
    position: 'relative',
    border: '1px solid rgba(158, 198, 223, .72)',
    borderRadius: mobile ? 20 : 24,
    background: 'linear-gradient(180deg, rgba(244,251,255,.84), rgba(226,241,250,.68))',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.96), 0 14px 34px rgba(97, 141, 170, .11)',
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
            background: 'rgba(207, 228, 241, .58)',
            backdropFilter: 'blur(16px) saturate(.9)',
            WebkitBackdropFilter: 'blur(16px) saturate(.9)',
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
              <div style={{ fontSize: mobile ? 19 : 24, fontWeight: 650, letterSpacing: '.035em' }}>
                {copy.title}
              </div>
              <div style={{ marginTop: 5, fontSize: mobile ? 11 : 13, opacity: .72, letterSpacing: '.08em' }}>
                {copy.current} · {String(selectedIndex + 1).padStart(2, '0')} / {String(CD_URLS.length).padStart(2, '0')}
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
                  width: mobile ? '100%' : '100%',
                  minHeight: mobile ? 398 : 0,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: mobile ? 'min(248px, 67vw)' : 'min(430px, 37vw, 58vh)',
                    aspectRatio: '2 / 3',
                    marginTop: mobile ? -4 : 0,
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
                      left: '50%',
                      top: mobile ? '-3.5%' : '-4.5%',
                      width: mobile ? '76%' : '77%',
                      aspectRatio: '1',
                      transform: 'translateX(-50%)',
                      zIndex: 2,
                      opacity: flight ? 0 : 1,
                      pointerEvents: 'none',
                    }}
                  >
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
                  width: mobile ? '100%' : '100%',
                  alignSelf: mobile ? 'center' : 'center',
                  padding: mobile ? '12px 10px 11px' : '18px 16px 16px',
                  boxSizing: 'border-box',
                  maxWidth: mobile ? 350 : 410,
                }}
              >
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: mobile ? 14 : 17,
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
                    const selected = index === selectedIndex
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
        </div>
      )}
    </>
  )
}
