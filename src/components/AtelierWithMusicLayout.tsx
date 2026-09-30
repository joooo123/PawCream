import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AtelierWithMusic from './AtelierWithMusic'

type DeviceProfile = 'desktop' | 'mobile'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

type SpoonTune = {
  startX: number
  startY: number
  startRotation: number
  endX: number
  endY: number
  endRotation: number
  scale: number
}

type SpoonTuneProfiles = Record<DeviceProfile, SpoonTune>

type SpoonRangeProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}

const MUSIC_TUNE_STORAGE_KEY = 'pawcream-music-tune-v1'
const MUSIC_LAYOUT_SEED_KEY = 'pawcream-music-layout-seed-20260930-v2'
const SPOON_TUNE_STORAGE_KEY = 'pawcream-music-spoon-tune-v1'
const SPOON_TUNE_SEED_KEY = 'pawcream-music-spoon-seed-20260930-v3'
const SPOON_URL = `${import.meta.env.BASE_URL}assets/music%20player/${encodeURIComponent('勺子播放.png')}?v=1eab2447`

const FINAL_MUSIC_TUNE = {
  desktop: {
    coneX: 69.5,
    coneY: 43.5,
    coneWidth: 142,
    discScale: 25,
    discX: 48,
    discY: 42,
    fontBoost: 3,
  },
  mobile: {
    coneX: 76.5,
    coneY: 40.5,
    coneWidth: 171.5,
    discScale: 27,
    discX: 48,
    discY: 40.5,
    fontBoost: 5,
  },
} as const

const DEFAULT_SPOON_TUNE: SpoonTuneProfiles = {
  desktop: {
    startX: 65,
    startY: 36.5,
    startRotation: 70,
    endX: 60,
    endY: 34,
    endRotation: 104,
    scale: 29,
  },
  mobile: {
    startX: 30,
    startY: 40,
    startRotation: 59,
    endX: 34,
    endY: 36.5,
    endRotation: 14,
    scale: 26,
  },
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function sanitizeSpoonTune(source: Partial<SpoonTune> | undefined, fallback: SpoonTune): SpoonTune {
  return {
    startX: clamp(Number(source?.startX ?? fallback.startX), -30, 130),
    startY: clamp(Number(source?.startY ?? fallback.startY), -30, 130),
    startRotation: clamp(Number(source?.startRotation ?? fallback.startRotation), -180, 180),
    endX: clamp(Number(source?.endX ?? fallback.endX), -30, 130),
    endY: clamp(Number(source?.endY ?? fallback.endY), -30, 130),
    endRotation: clamp(Number(source?.endRotation ?? fallback.endRotation), -180, 180),
    scale: clamp(Number(source?.scale ?? fallback.scale), 8, 70),
  }
}

function readSpoonTuneProfiles(): SpoonTuneProfiles {
  if (typeof window === 'undefined') return DEFAULT_SPOON_TUNE
  try {
    const raw = window.localStorage.getItem(SPOON_TUNE_STORAGE_KEY)
    if (!raw) return DEFAULT_SPOON_TUNE
    const parsed = JSON.parse(raw) as Partial<Record<DeviceProfile, Partial<SpoonTune>>>
    return {
      desktop: sanitizeSpoonTune(parsed.desktop, DEFAULT_SPOON_TUNE.desktop),
      mobile: sanitizeSpoonTune(parsed.mobile, DEFAULT_SPOON_TUNE.mobile),
    }
  } catch {
    return DEFAULT_SPOON_TUNE
  }
}

function seedMusicTuneOnce() {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem(MUSIC_LAYOUT_SEED_KEY) === '1') return

  window.localStorage.setItem(MUSIC_TUNE_STORAGE_KEY, JSON.stringify(FINAL_MUSIC_TUNE))
  window.localStorage.setItem(MUSIC_LAYOUT_SEED_KEY, '1')
}

function seedSpoonTuneOnce() {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem(SPOON_TUNE_SEED_KEY) === '1') return

  window.localStorage.setItem(SPOON_TUNE_STORAGE_KEY, JSON.stringify(DEFAULT_SPOON_TUNE))
  window.localStorage.setItem(SPOON_TUNE_SEED_KEY, '1')
}

function SpoonRange({ label, value, min, max, step = 1, suffix = '', onChange }: SpoonRangeProps) {
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
        style={{ width: '100%', accentColor: '#d99ab3', cursor: 'ew-resize' }}
      />
      <output style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#8a7080' }}>
        {Number.isInteger(value) ? value : value.toFixed(1)}{suffix}
      </output>
    </label>
  )
}

function useConeFrontFlightMask() {
  useEffect(() => {
    let mask: HTMLImageElement | null = null
    let frame = 0

    const removeMask = () => {
      if (!mask) return
      mask.remove()
      mask = null
    }

    const syncMask = () => {
      const overlay = document.querySelector<HTMLElement>('.pawcream-music-overlay')
      if (!overlay) {
        removeMask()
        return
      }

      const flyingDiscs = Array.from(overlay.querySelectorAll<HTMLImageElement>('img')).filter((image) => {
        const src = image.getAttribute('src') || ''
        return image.style.position === 'fixed' && src.includes('/assets/music%20player/cd')
      })

      if (flyingDiscs.length === 0) {
        removeMask()
        return
      }

      const front = Array.from(overlay.querySelectorAll<HTMLImageElement>('img')).find((image) =>
        (image.getAttribute('src') || '').includes('icecream%20front.png'),
      )
      if (!front) return

      const rect = front.getBoundingClientRect()
      if (!mask) {
        mask = front.cloneNode(false) as HTMLImageElement
        mask.className = 'pawcream-music-flight-front-mask'
        mask.alt = ''
        mask.setAttribute('aria-hidden', 'true')
        mask.draggable = false
        overlay.appendChild(mask)
      }

      Object.assign(mask.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        objectFit: 'contain',
        zIndex: '122',
        pointerEvents: 'none',
        userSelect: 'none',
        filter: 'none',
      })
    }

    const scheduleSync = () => {
      if (frame) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = 0
        syncMask()
      })
    }

    const observer = new MutationObserver(scheduleSync)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', scheduleSync)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', scheduleSync)
      if (frame) window.cancelAnimationFrame(frame)
      removeMask()
    }
  }, [])
}

export default function AtelierWithMusicLayout(props: Props) {
  seedMusicTuneOnce()
  seedSpoonTuneOnce()
  useConeFrontFlightMask()

  const [coneHost, setConeHost] = useState<HTMLElement | null>(null)
  const [tunePanelHost, setTunePanelHost] = useState<HTMLElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [swapLocked, setSwapLocked] = useState(false)
  const [spoonProfiles, setSpoonProfiles] = useState<SpoonTuneProfiles>(readSpoonTuneProfiles)
  const [copyStatus, setCopyStatus] = useState('复制勺子参数')

  const mobile = props.deviceProfile === 'mobile'
  const spoonTune = spoonProfiles[props.deviceProfile]

  useEffect(() => {
    const image = new Image()
    image.decoding = 'async'
    image.src = SPOON_URL
  }, [])

  useEffect(() => {
    const syncTargets = () => {
      const nextCone = document.querySelector<HTMLElement>('section[aria-label="Current music disc"] > div')
      const nextTunePanel = document.querySelector<HTMLElement>('aside[aria-label="PawCream Music tune panel"]')
      setConeHost((current) => current === nextCone ? current : nextCone)
      setTunePanelHost((current) => current === nextTunePanel ? current : nextTunePanel)

      if (!document.querySelector('.pawcream-music-current-disc')) {
        setIsPlaying(false)
      }
    }

    syncTargets()
    const observer = new MutationObserver(syncTargets)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [props.deviceProfile])

  useEffect(() => {
    document.documentElement.classList.toggle('pawcream-music-spoon-playing', isPlaying)
    return () => document.documentElement.classList.remove('pawcream-music-spoon-playing')
  }, [isPlaying])

  useEffect(() => {
    let unlockTimer = 0
    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('.pawcream-music-slot-button')) return

      setIsPlaying(false)
      setSwapLocked(true)
      if (unlockTimer) window.clearTimeout(unlockTimer)
      unlockTimer = window.setTimeout(() => setSwapLocked(false), 650)
    }

    document.addEventListener('click', onClickCapture, true)
    return () => {
      document.removeEventListener('click', onClickCapture, true)
      if (unlockTimer) window.clearTimeout(unlockTimer)
    }
  }, [])

  const updateSpoonTune = (patch: Partial<SpoonTune>) => {
    setSpoonProfiles((current) => {
      const next: SpoonTuneProfiles = {
        ...current,
        [props.deviceProfile]: {
          ...current[props.deviceProfile],
          ...patch,
        },
      }
      window.localStorage.setItem(SPOON_TUNE_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const resetSpoonTune = () => {
    setSpoonProfiles((current) => {
      const next: SpoonTuneProfiles = {
        ...current,
        [props.deviceProfile]: { ...DEFAULT_SPOON_TUNE[props.deviceProfile] },
      }
      window.localStorage.setItem(SPOON_TUNE_STORAGE_KEY, JSON.stringify(next))
      return next
    })
    setIsPlaying(false)
  }

  const copySpoonTune = async () => {
    const format = (profile: DeviceProfile) => {
      const value = spoonProfiles[profile]
      return `${profile}: spoonScale=${value.scale}%, startX=${value.startX}%, startY=${value.startY}%, startRotation=${value.startRotation}deg, endX=${value.endX}%, endY=${value.endY}%, endRotation=${value.endRotation}deg`
    }
    const text = ['PawCream Spoon Tune', format('desktop'), format('mobile')].join('\n')

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
    window.setTimeout(() => setCopyStatus('复制勺子参数'), 1300)
  }

  const triggerPickFlavor = () => {
    const subtitle = document.querySelector<HTMLElement>('.pawcream-music-panel > div > aside > div:first-child')
    if (!subtitle) return

    subtitle.classList.remove('pawcream-music-pick-alert')
    void subtitle.offsetWidth
    subtitle.classList.add('pawcream-music-pick-alert')
    window.setTimeout(() => subtitle.classList.remove('pawcream-music-pick-alert'), 900)
  }

  const handleSpoonClick = () => {
    if (swapLocked) return
    const hasDisc = Boolean(document.querySelector('.pawcream-music-current-disc'))
    if (!hasDisc) {
      setIsPlaying(false)
      triggerPickFlavor()
      return
    }

    setIsPlaying((current) => !current)
  }

  const spoonX = isPlaying ? spoonTune.endX : spoonTune.startX
  const spoonY = isPlaying ? spoonTune.endY : spoonTune.startY
  const spoonRotation = isPlaying ? spoonTune.endRotation : spoonTune.startRotation

  return (
    <>
      <style>{`
        .pawcream-music-current-disc {
          animation-play-state: paused !important;
        }
        html.pawcream-music-spoon-playing .pawcream-music-current-disc {
          animation-play-state: running !important;
        }
        @keyframes pawcream-music-pick-alert-bounce {
          0% { transform: translateY(0) scale(1); color: #6b8fa8; }
          18% { transform: translateY(-8px) scale(1.2); color: #df7fa7; }
          34% { transform: translateY(0) scale(1.13); color: #df7fa7; }
          52% { transform: translateY(-8px) scale(1.2); color: #df7fa7; }
          68% { transform: translateY(0) scale(1.13); color: #df7fa7; }
          100% { transform: translateY(0) scale(1); color: #6b8fa8; }
        }
        .pawcream-music-pick-alert {
          animation: pawcream-music-pick-alert-bounce 820ms cubic-bezier(.28,.8,.3,1) both !important;
          transform-origin: 50% 50%;
        }
      `}</style>

      {mobile && (
        <style>{`
          .pawcream-music-panel {
            overflow: hidden !important;
          }

          .pawcream-music-panel > div > aside {
            position: absolute !important;
            left: 13px !important;
            right: 13px !important;
            bottom: 12px !important;
            width: auto !important;
            max-width: none !important;
            margin: 0 !important;
            z-index: 6 !important;
          }
        `}</style>
      )}

      <AtelierWithMusic {...props} />

      {coneHost && createPortal(
        <button
          type="button"
          aria-label={isPlaying ? 'Pause music' : 'Play music'}
          aria-pressed={isPlaying}
          onClick={handleSpoonClick}
          disabled={swapLocked}
          style={{
            position: 'absolute',
            left: `${spoonX}%`,
            top: `${spoonY}%`,
            width: `${spoonTune.scale}%`,
            border: 0,
            background: 'transparent',
            padding: 0,
            margin: 0,
            zIndex: 4,
            cursor: swapLocked ? 'default' : 'pointer',
            transform: `translate(-50%, -50%) rotate(${spoonRotation}deg)`,
            transformOrigin: '50% 50%',
            transition: 'left 480ms cubic-bezier(.2,.8,.2,1), top 480ms cubic-bezier(.2,.8,.2,1), transform 480ms cubic-bezier(.2,.8,.2,1)',
            filter: isPlaying
              ? 'drop-shadow(0 8px 10px rgba(93, 91, 104, .20))'
              : 'drop-shadow(0 6px 9px rgba(93, 91, 104, .12))',
          }}
        >
          <img
            src={SPOON_URL}
            alt=""
            aria-hidden="true"
            draggable={false}
            decoding="async"
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        </button>,
        coneHost,
      )}

      {tunePanelHost && createPortal(
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid rgba(217, 154, 179, .32)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 7, color: '#8a7080' }}>勺子唱针</div>
          <SpoonRange label="勺子大小" value={spoonTune.scale} min={8} max={70} step={0.5} suffix="%" onChange={(value) => updateSpoonTune({ scale: value })} />
          <SpoonRange label="起点 X" value={spoonTune.startX} min={-30} max={130} step={0.5} suffix="%" onChange={(value) => updateSpoonTune({ startX: value })} />
          <SpoonRange label="起点 Y" value={spoonTune.startY} min={-30} max={130} step={0.5} suffix="%" onChange={(value) => updateSpoonTune({ startY: value })} />
          <SpoonRange label="起点旋转" value={spoonTune.startRotation} min={-180} max={180} step={1} suffix="°" onChange={(value) => updateSpoonTune({ startRotation: value })} />
          <SpoonRange label="终点 X" value={spoonTune.endX} min={-30} max={130} step={0.5} suffix="%" onChange={(value) => updateSpoonTune({ endX: value })} />
          <SpoonRange label="终点 Y" value={spoonTune.endY} min={-30} max={130} step={0.5} suffix="%" onChange={(value) => updateSpoonTune({ endY: value })} />
          <SpoonRange label="终点旋转" value={spoonTune.endRotation} min={-180} max={180} step={1} suffix="°" onChange={(value) => updateSpoonTune({ endRotation: value })} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 10 }}>
            <button
              type="button"
              onClick={resetSpoonTune}
              style={{
                minHeight: 34,
                border: '1px solid rgba(217,154,179,.46)',
                borderRadius: 10,
                background: 'rgba(255,255,255,.76)',
                color: '#876d7d',
                cursor: 'pointer',
              }}
            >
              重置勺子
            </button>
            <button
              type="button"
              onClick={copySpoonTune}
              style={{
                minHeight: 34,
                border: '1px solid rgba(217,154,179,.46)',
                borderRadius: 10,
                background: 'rgba(251,229,238,.86)',
                color: '#876274',
                cursor: 'pointer',
              }}
            >
              {copyStatus}
            </button>
          </div>
        </div>,
        tunePanelHost,
      )}
    </>
  )
}
