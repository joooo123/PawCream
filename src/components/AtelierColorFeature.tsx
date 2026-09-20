import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import type { DeviceProfile } from '../App'

type ColorLayout = {
  x: number
  y: number
  width: number
}

type ColorProfiles = Record<DeviceProfile, ColorLayout>

type Props = {
  deviceProfile: DeviceProfile
}

const COLOR_STORAGE_KEY = 'pawcream-color-tuning-v1'
const BACKGROUND_STORAGE_KEY = 'pawcream-atelier-background-v1'

const COLOR_ASSET_VERSION = '7f85d4bc59223223e05171ccc40e4009d1f99529'
const BACKGROUND_VERSIONS = [
  '490fae2d4e560f1ab427c535f2caa0f59efd27f8',
  '952b5d1b813f6a6872b54a509847dc5ce6e96879',
  '8e09df228690d4971861a7b18d1b10a88199e12e',
] as const

const COLOR_DEFAULTS: ColorProfiles = {
  desktop: { x: 88, y: 82, width: 14 },
  mobile: { x: 75, y: 88, width: 30 },
}

const assetUrl = (name: string, version: string) => {
  const url = `${import.meta.env.BASE_URL}assets/atelier/${name}`
  return `${url}?v=${version}`
}

const COLOR_ASSET_URL = assetUrl('color.png', COLOR_ASSET_VERSION)
const BACKGROUND_URLS = [
  assetUrl('background.png', BACKGROUND_VERSIONS[0]),
  assetUrl('background2.png', BACKGROUND_VERSIONS[1]),
  assetUrl('background3.png', BACKGROUND_VERSIONS[2]),
]

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const cloneDefaults = (): ColorProfiles => ({
  desktop: { ...COLOR_DEFAULTS.desktop },
  mobile: { ...COLOR_DEFAULTS.mobile },
})

const mergeProfiles = (
  parsed: Partial<Record<DeviceProfile, Partial<ColorLayout>>>,
): ColorProfiles => {
  const next = cloneDefaults()
  ;(['desktop', 'mobile'] as DeviceProfile[]).forEach((profile) => {
    const source = parsed[profile]
    if (!source) return
    const fallback = next[profile]
    next[profile] = {
      x: typeof source.x === 'number' && Number.isFinite(source.x) ? source.x : fallback.x,
      y: typeof source.y === 'number' && Number.isFinite(source.y) ? source.y : fallback.y,
      width:
        typeof source.width === 'number' && Number.isFinite(source.width)
          ? source.width
          : fallback.width,
    }
  })
  return next
}

const loadProfiles = (): ColorProfiles => {
  if (typeof window === 'undefined') return cloneDefaults()
  try {
    const raw = window.localStorage.getItem(COLOR_STORAGE_KEY)
    return raw
      ? mergeProfiles(
          JSON.parse(raw) as Partial<Record<DeviceProfile, Partial<ColorLayout>>>,
        )
      : cloneDefaults()
  } catch {
    return cloneDefaults()
  }
}

const loadBackgroundIndex = () => {
  if (typeof window === 'undefined') return 0
  try {
    const value = Number(window.localStorage.getItem(BACKGROUND_STORAGE_KEY))
    return Number.isInteger(value) && value >= 0 && value < BACKGROUND_URLS.length
      ? value
      : 0
  } catch {
    return 0
  }
}

const panelStyle: CSSProperties = {
  position: 'fixed',
  left: 18,
  bottom: 18,
  zIndex: 75,
  width: 'min(310px, calc(100vw - 36px))',
  padding: '14px 15px 15px',
  border: '1px solid rgba(198, 133, 157, 0.25)',
  borderRadius: 18,
  background: 'rgba(255, 252, 253, 0.94)',
  boxShadow: '0 18px 50px rgba(113, 81, 91, 0.13)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  color: '#745f66',
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const buttonStyle: CSSProperties = {
  minHeight: 32,
  border: '1px solid rgba(198, 133, 157, 0.24)',
  borderRadius: 11,
  background: 'rgba(255,255,255,0.8)',
  color: '#876974',
  cursor: 'pointer',
  fontSize: 10,
  padding: '5px 8px',
}

function RangeRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label
      style={{
        display: 'grid',
        gridTemplateColumns: '50px 1fr 52px',
        alignItems: 'center',
        gap: 8,
        minHeight: 31,
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
        style={{ width: '100%', accentColor: '#d58da8' }}
      />
      <output style={{ textAlign: 'right', color: '#a17f8a', fontVariantNumeric: 'tabular-nums' }}>
        {value.toFixed(1)}%
      </output>
    </label>
  )
}

export default function AtelierColorFeature({ deviceProfile }: Props) {
  const tuneMode = useMemo(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('tune') === '1',
    [],
  )

  const [stage, setStage] = useState<HTMLElement | null>(null)
  const [profiles, setProfiles] = useState<ColorProfiles>(loadProfiles)
  const [backgroundIndex, setBackgroundIndex] = useState(loadBackgroundIndex)
  const [dragPointerId, setDragPointerId] = useState<number | null>(null)
  const [copyStatus, setCopyStatus] = useState('复制 Color 双端参数')

  useEffect(() => {
    const findStage = () =>
      document.querySelector<HTMLElement>('section[aria-label^="PawCream Atelier Room"]')

    const current = findStage()
    if (current) setStage(current)

    const observer = new MutationObserver(() => {
      const next = findStage()
      setStage((previous) => (previous === next ? previous : next))
    })
    observer.observe(document.getElementById('root') ?? document.body, {
      childList: true,
      subtree: true,
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--atelier-background-image',
      `url("${BACKGROUND_URLS[backgroundIndex]}")`,
    )
    try {
      window.localStorage.setItem(BACKGROUND_STORAGE_KEY, String(backgroundIndex))
    } catch {
      // Background switching still works without storage.
    }
  }, [backgroundIndex])

  useEffect(() => {
    if (!tuneMode) return
    try {
      window.localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(profiles))
    } catch {
      // Tuning still works for the current session.
    }
  }, [profiles, tuneMode])

  const current = profiles[deviceProfile]

  const updateCurrent = (field: keyof ColorLayout, value: number) => {
    setProfiles((all) => ({
      ...all,
      [deviceProfile]: {
        ...all[deviceProfile],
        [field]: value,
      },
    }))
  }

  const moveFromPointer = (clientX: number, clientY: number) => {
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = Number(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100).toFixed(1))
    const y = Number(clamp(((clientY - rect.top) / rect.height) * 100, 0, 100).toFixed(1))
    setProfiles((all) => ({
      ...all,
      [deviceProfile]: { ...all[deviceProfile], x, y },
    }))
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (!tuneMode) return
    setDragPointerId(event.pointerId)
    event.currentTarget.setPointerCapture(event.pointerId)
    moveFromPointer(event.clientX, event.clientY)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (!tuneMode || dragPointerId !== event.pointerId) return
    moveFromPointer(event.clientX, event.clientY)
  }

  const endPointer = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (dragPointerId !== event.pointerId) return
    setDragPointerId(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const cycleBackground = () => {
    if (tuneMode) return
    setBackgroundIndex((index) => (index + 1) % BACKGROUND_URLS.length)
  }

  const copySettings = async () => {
    const text = `ATELIER_COLOR_DEFAULTS = ${JSON.stringify(profiles, null, 2)}`
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('已复制 Color 参数')
    } catch {
      setCopyStatus('复制失败')
    }
    window.setTimeout(() => setCopyStatus('复制 Color 双端参数'), 1300)
  }

  const resetCurrent = () => {
    setProfiles((all) => ({
      ...all,
      [deviceProfile]: { ...COLOR_DEFAULTS[deviceProfile] },
    }))
  }

  const colorNode = (
    <img
      src={COLOR_ASSET_URL}
      alt="Color"
      role="button"
      tabIndex={0}
      aria-label="Change Atelier background"
      draggable={false}
      decoding="async"
      onClick={cycleBackground}
      onKeyDown={(event) => {
        if (tuneMode) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          cycleBackground()
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      style={{
        position: 'absolute',
        left: `${current.x}%`,
        top: `${current.y}%`,
        width: `${current.width}%`,
        height: 'auto',
        transform: 'translate(-50%, -50%)',
        transformOrigin: '50% 50%',
        zIndex: 13,
        display: 'block',
        cursor: tuneMode ? 'grab' : 'pointer',
        touchAction: tuneMode ? 'none' : 'auto',
        userSelect: 'none',
        outline: tuneMode ? '1.5px dashed rgba(213, 111, 157, 0.9)' : 'none',
        outlineOffset: tuneMode ? 6 : 0,
        borderRadius: tuneMode ? 10 : 0,
      }}
    />
  )

  return (
    <>
      {stage ? createPortal(colorNode, stage) : null}

      {tuneMode && (
        <aside aria-label="PawCream Color Tune" style={panelStyle}>
          <strong style={{ display: 'block', fontSize: 12 }}>Color Tune</strong>
          <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: '#aa8c96' }}>
            {deviceProfile === 'desktop' ? '电脑端' : '手机端'} · Color
          </span>

          <div
            style={{
              marginTop: 10,
              paddingTop: 9,
              borderTop: '1px solid rgba(198, 133, 157, 0.14)',
            }}
          >
            <RangeRow label="X" value={current.x} min={0} max={100} step={0.5} onChange={(v) => updateCurrent('x', v)} />
            <RangeRow label="Y" value={current.y} min={0} max={100} step={0.5} onChange={(v) => updateCurrent('y', v)} />
            <RangeRow label="Size" value={current.width} min={5} max={120} step={0.5} onChange={(v) => updateCurrent('width', v)} />
          </div>

          <strong style={{ display: 'block', marginTop: 10, marginBottom: 7, fontSize: 11 }}>
            背景预览
          </strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {BACKGROUND_URLS.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setBackgroundIndex(index)}
                style={{
                  ...buttonStyle,
                  background:
                    backgroundIndex === index ? '#f8e8ee' : 'rgba(255,255,255,0.8)',
                  borderColor:
                    backgroundIndex === index
                      ? 'rgba(213, 111, 157, 0.5)'
                      : 'rgba(198, 133, 157, 0.24)',
                }}
              >
                BG {index + 1}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 11 }}>
            <button type="button" onClick={copySettings} style={{ ...buttonStyle, background: '#f8e8ee' }}>
              {copyStatus}
            </button>
            <button type="button" onClick={resetCurrent} style={buttonStyle}>
              恢复当前端
            </button>
          </div>

          <p style={{ margin: '9px 0 0', fontSize: 9.5, lineHeight: 1.45, color: '#aa8c96' }}>
            正式页点击 Color：Background 1 → 2 → 3 → 1。位置与大小按电脑端 / 手机端分别保存。
          </p>
        </aside>
      )}
    </>
  )
}
