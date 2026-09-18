import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react'

type Props = {
  onBack: () => void
}

type AssetKey = 'light' | 'message' | 'instax' | 'sewing'
type DeviceProfile = 'desktop' | 'mobile'

type AssetLayout = {
  x: number
  y: number
  width: number
}

type AtelierTuning = Record<AssetKey, AssetLayout>
type AtelierProfiles = Record<DeviceProfile, AtelierTuning>

const STORAGE_KEY = 'pawcream-atelier-tuning-v2'
const LEGACY_STORAGE_KEY = 'pawcream-atelier-tuning-v1'
const MOBILE_BREAKPOINT = 700

const ASSETS: Record<AssetKey, { src: string; label: string; zIndex: number }> = {
  light: {
    src: `${import.meta.env.BASE_URL}assets/atelier/light.png`,
    label: 'Light',
    zIndex: 1,
  },
  message: {
    src: `${import.meta.env.BASE_URL}assets/atelier/message.png`,
    label: 'Message',
    zIndex: 2,
  },
  instax: {
    src: `${import.meta.env.BASE_URL}assets/atelier/instax.png`,
    label: 'Instax',
    zIndex: 3,
  },
  sewing: {
    src: `${import.meta.env.BASE_URL}assets/atelier/sewing%20machine.png`,
    label: 'Sewing machine',
    zIndex: 4,
  },
}

const ASSET_ORDER: AssetKey[] = ['light', 'message', 'instax', 'sewing']

const ATELIER_TUNING_DEFAULTS: AtelierProfiles = {
  desktop: {
    light: { x: 67, y: 18, width: 24 },
    message: { x: 25, y: 28, width: 22 },
    instax: { x: 25, y: 69, width: 22 },
    sewing: { x: 61, y: 64, width: 44 },
  },
  mobile: {
    light: { x: 68, y: 15, width: 40 },
    message: { x: 27, y: 31, width: 38 },
    instax: { x: 27, y: 61, width: 38 },
    sewing: { x: 58, y: 79, width: 74 },
  },
}

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: 18,
  right: 18,
  zIndex: 60,
  width: 'min(340px, calc(100vw - 36px))',
  maxHeight: 'calc(100svh - 36px)',
  overflow: 'hidden',
  border: '1px solid rgba(198, 133, 157, 0.28)',
  borderRadius: 20,
  background: 'rgba(255, 252, 253, 0.92)',
  boxShadow: '0 18px 50px rgba(113, 81, 91, 0.12)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  color: '#745f66',
  fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const smallButtonStyle: CSSProperties = {
  minHeight: 32,
  border: '1px solid rgba(198, 133, 157, 0.24)',
  borderRadius: 11,
  background: 'rgba(255, 255, 255, 0.78)',
  color: '#876974',
  cursor: 'pointer',
  fontSize: 11,
}

function cloneLayout(source: AtelierTuning): AtelierTuning {
  return {
    light: { ...source.light },
    message: { ...source.message },
    instax: { ...source.instax },
    sewing: { ...source.sewing },
  }
}

function cloneDefaults(): AtelierProfiles {
  return {
    desktop: cloneLayout(ATELIER_TUNING_DEFAULTS.desktop),
    mobile: cloneLayout(ATELIER_TUNING_DEFAULTS.mobile),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function mergeLayout(
  source: Partial<Record<AssetKey, Partial<AssetLayout>>> | undefined,
  fallback: AtelierTuning,
): AtelierTuning {
  const next = cloneLayout(fallback)
  if (!source) return next

  for (const key of ASSET_ORDER) {
    const item = source[key]
    if (!item) continue
    const current = next[key]
    next[key] = {
      x: typeof item.x === 'number' && Number.isFinite(item.x) ? item.x : current.x,
      y: typeof item.y === 'number' && Number.isFinite(item.y) ? item.y : current.y,
      width:
        typeof item.width === 'number' && Number.isFinite(item.width)
          ? item.width
          : current.width,
    }
  }

  return next
}

function loadTuning(enabled: boolean): AtelierProfiles {
  if (!enabled || typeof window === 'undefined') return cloneDefaults()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<DeviceProfile, Partial<Record<AssetKey, Partial<AssetLayout>>>>>
      return {
        desktop: mergeLayout(parsed.desktop, ATELIER_TUNING_DEFAULTS.desktop),
        mobile: mergeLayout(parsed.mobile, ATELIER_TUNING_DEFAULTS.mobile),
      }
    }

    // v1 only had one layout. Preserve it as the desktop profile and start the
    // mobile profile from its own dedicated defaults.
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Partial<Record<AssetKey, Partial<AssetLayout>>>
      return {
        desktop: mergeLayout(legacy, ATELIER_TUNING_DEFAULTS.desktop),
        mobile: cloneLayout(ATELIER_TUNING_DEFAULTS.mobile),
      }
    }
  } catch {
    return cloneDefaults()
  }

  return cloneDefaults()
}

function getDeviceFromUrl(): DeviceProfile | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('device')
  return value === 'mobile' || value === 'desktop' ? value : null
}

function getDetectedDevice(): DeviceProfile {
  if (typeof window === 'undefined') return 'desktop'
  return window.innerWidth <= MOBILE_BREAKPOINT ? 'mobile' : 'desktop'
}

function RangeRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label
      style={{
        display: 'grid',
        gridTemplateColumns: '62px 1fr 54px',
        alignItems: 'center',
        gap: 8,
        minHeight: 32,
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
        style={{ width: '100%', accentColor: '#d58da8', cursor: 'ew-resize' }}
      />
      <output style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#a17f8a' }}>
        {value.toFixed(step < 1 ? 1 : 0)}{suffix}
      </output>
    </label>
  )
}

export default function AtelierPlaceholder({ onBack }: Props) {
  const artboardRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ key: AssetKey; pointerId: number } | null>(null)

  const tuneMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tune') === '1',
    [],
  )

  const [detectedProfile, setDetectedProfile] = useState<DeviceProfile>(() => getDetectedDevice())
  const [activeProfile, setActiveProfile] = useState<DeviceProfile>(() => getDeviceFromUrl() ?? getDetectedDevice())
  const [tuning, setTuning] = useState<AtelierProfiles>(() => loadTuning(tuneMode))
  const [selectedKey, setSelectedKey] = useState<AssetKey>('sewing')
  const [collapsed, setCollapsed] = useState(false)
  const [copyStatus, setCopyStatus] = useState('复制双端参数')

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const update = () => setDetectedProfile(media.matches ? 'mobile' : 'desktop')
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    if (!tuneMode) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tuning))
  }, [tuneMode, tuning])

  const renderProfile = tuneMode ? activeProfile : detectedProfile
  const renderTuning = tuning[renderProfile]
  const selected = tuning[activeProfile][selectedKey]
  const isMobilePreview = renderProfile === 'mobile'

  const switchProfile = (profile: DeviceProfile) => {
    setActiveProfile(profile)
    if (!tuneMode) return
    const url = new URL(window.location.href)
    url.searchParams.set('device', profile)
    window.history.replaceState(null, '', url)
  }

  const updateSelected = (field: keyof AssetLayout, value: number) => {
    setTuning((current) => ({
      ...current,
      [activeProfile]: {
        ...current[activeProfile],
        [selectedKey]: {
          ...current[activeProfile][selectedKey],
          [field]: value,
        },
      },
    }))
  }

  const moveAssetFromPointer = (key: AssetKey, clientX: number, clientY: number) => {
    const artboard = artboardRef.current
    if (!artboard) return

    const rect = artboard.getBoundingClientRect()
    const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)
    const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100)

    setTuning((current) => ({
      ...current,
      [activeProfile]: {
        ...current[activeProfile],
        [key]: {
          ...current[activeProfile][key],
          x: Number(x.toFixed(1)),
          y: Number(y.toFixed(1)),
        },
      },
    }))
  }

  const onAssetPointerDown = (key: AssetKey, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!tuneMode) return
    setSelectedKey(key)
    dragRef.current = { key, pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
    moveAssetFromPointer(key, event.clientX, event.clientY)
  }

  const onAssetPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = dragRef.current
    if (!active || active.pointerId !== event.pointerId) return
    moveAssetFromPointer(active.key, event.clientX, event.clientY)
  }

  const onAssetPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = dragRef.current
    if (!active || active.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const copySettings = async () => {
    const text = `ATELIER_TUNING_DEFAULTS = ${JSON.stringify(tuning, null, 2)}`
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('已复制')
      window.setTimeout(() => setCopyStatus('复制双端参数'), 1200)
    } catch {
      setCopyStatus('复制失败')
      window.setTimeout(() => setCopyStatus('复制双端参数'), 1500)
    }
  }

  const resetCurrentProfile = () => {
    setTuning((current) => ({
      ...current,
      [activeProfile]: cloneLayout(ATELIER_TUNING_DEFAULTS[activeProfile]),
    }))
    setSelectedKey('sewing')
  }

  const stageStyle: CSSProperties = isMobilePreview
    ? {
        position: 'relative',
        width: tuneMode
          ? 'min(390px, 52vw, calc((100svh - 48px) * 9 / 16))'
          : 'min(100vw, 520px, calc(100svh * 9 / 16))',
        aspectRatio: '9 / 16',
        maxWidth: '100%',
        overflow: 'visible',
        background: '#ffffff',
        boxShadow: tuneMode ? '0 0 0 1px rgba(198, 133, 157, 0.22)' : 'none',
      }
    : {
        position: 'relative',
        width: tuneMode
          ? 'min(1080px, 78vw, 130vh)'
          : 'min(1320px, 94vw, 140vh)',
        aspectRatio: '16 / 10',
        maxWidth: '100%',
        overflow: 'visible',
        background: '#ffffff',
        boxShadow: tuneMode ? '0 0 0 1px rgba(198, 133, 157, 0.16)' : 'none',
      }

  return (
    <main
      style={{
        minHeight: '100svh',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        background: '#ffffff',
        position: 'relative',
        isolation: 'isolate',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to PawCream home"
        style={{
          position: 'fixed',
          left: 18,
          top: 18,
          zIndex: 55,
          border: '1px solid rgba(164, 132, 143, 0.2)',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.82)',
          color: '#8e757d',
          padding: '8px 13px',
          cursor: 'pointer',
          boxShadow: '0 8px 28px rgba(100, 79, 86, 0.07)',
          backdropFilter: 'blur(12px)',
        }}
      >
        ← Home
      </button>

      <section
        ref={artboardRef}
        aria-label={`PawCream Atelier Room ${renderProfile} layout`}
        style={stageStyle}
      >
        <h1
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          PawCream Atelier Room
        </h1>

        {tuneMode && (
          <span
            style={{
              position: 'absolute',
              left: 8,
              bottom: 8,
              zIndex: 50,
              padding: '4px 8px',
              borderRadius: 999,
              background: 'rgba(255, 249, 252, 0.9)',
              color: '#a4687f',
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 10,
              pointerEvents: 'none',
            }}
          >
            {isMobilePreview ? 'Mobile preview · 9:16' : 'Desktop preview · 16:10'}
          </span>
        )}

        {ASSET_ORDER.map((key) => {
          const asset = ASSETS[key]
          const layout = renderTuning[key]
          const selectedAsset = tuneMode && selectedKey === key

          return (
            <div
              key={key}
              role={tuneMode ? 'button' : undefined}
              tabIndex={tuneMode ? 0 : undefined}
              aria-label={tuneMode ? `Move ${asset.label}` : undefined}
              onPointerDown={(event) => onAssetPointerDown(key, event)}
              onPointerMove={onAssetPointerMove}
              onPointerUp={onAssetPointerUp}
              onPointerCancel={onAssetPointerUp}
              onClick={() => tuneMode && setSelectedKey(key)}
              style={{
                position: 'absolute',
                left: `${layout.x}%`,
                top: `${layout.y}%`,
                width: `${layout.width}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: asset.zIndex,
                cursor: tuneMode ? 'grab' : 'default',
                touchAction: tuneMode ? 'none' : 'auto',
                userSelect: 'none',
                outline: selectedAsset ? '1.5px dashed rgba(213, 111, 157, 0.9)' : 'none',
                outlineOffset: selectedAsset ? 6 : 0,
                borderRadius: selectedAsset ? 10 : 0,
              }}
            >
              <img
                src={asset.src}
                alt={asset.label}
                draggable={false}
                decoding="async"
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />

              {selectedAsset && (
                <span
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: -27,
                    transform: 'translateX(-50%)',
                    padding: '3px 7px',
                    borderRadius: 999,
                    background: 'rgba(255, 249, 252, 0.96)',
                    color: '#a4687f',
                    fontSize: 10,
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                    boxShadow: '0 4px 14px rgba(113, 81, 91, 0.1)',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {asset.label}
                </span>
              )}
            </div>
          )
        })}
      </section>

      {tuneMode && (
        <aside style={{ ...panelStyle, width: collapsed ? 220 : panelStyle.width }}>
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              padding: '13px 14px 12px 16px',
              borderBottom: collapsed ? 0 : '1px solid rgba(198, 133, 157, 0.15)',
            }}
          >
            <div>
              <strong style={{ display: 'block', fontSize: 13 }}>Atelier Tune</strong>
              <span style={{ fontSize: 10, color: '#aa8c96' }}>电脑端 / 手机端 独立布局</span>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              style={{
                width: 30,
                height: 30,
                border: '1px solid rgba(198, 133, 157, 0.24)',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.75)',
                color: '#9d7180',
                cursor: 'pointer',
              }}
            >
              {collapsed ? '+' : '−'}
            </button>
          </header>

          {!collapsed && (
            <div style={{ maxHeight: 'calc(100svh - 92px)', overflowY: 'auto', padding: '14px 16px 16px' }}>
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: '#947a83' }}>
                两套参数完全独立。先切换电脑端 / 手机端，再调整当前端的四张图；正式页面会按屏幕宽度自动选择对应布局。
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 7,
                  marginTop: 13,
                }}
              >
                {(['desktop', 'mobile'] as DeviceProfile[]).map((profile) => (
                  <button
                    key={profile}
                    type="button"
                    onClick={() => switchProfile(profile)}
                    style={{
                      ...smallButtonStyle,
                      minHeight: 38,
                      fontWeight: 650,
                      background:
                        activeProfile === profile ? 'rgba(248, 232, 238, 0.98)' : 'rgba(255,255,255,0.78)',
                      borderColor:
                        activeProfile === profile
                          ? 'rgba(213, 111, 157, 0.55)'
                          : 'rgba(198, 133, 157, 0.24)',
                    }}
                  >
                    {profile === 'desktop' ? '电脑端 · 16:10' : '手机端 · 9:16'}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 7,
                  marginTop: 13,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(198, 133, 157, 0.13)',
                }}
              >
                {ASSET_ORDER.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    style={{
                      ...smallButtonStyle,
                      background:
                        selectedKey === key ? 'rgba(248, 232, 238, 0.98)' : 'rgba(255,255,255,0.78)',
                      borderColor:
                        selectedKey === key
                          ? 'rgba(213, 111, 157, 0.5)'
                          : 'rgba(198, 133, 157, 0.24)',
                    }}
                  >
                    {ASSETS[key].label}
                  </button>
                ))}
              </div>

              <section
                style={{
                  marginTop: 15,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(198, 133, 157, 0.13)',
                }}
              >
                <strong style={{ display: 'block', marginBottom: 7, fontSize: 11 }}>
                  {activeProfile === 'desktop' ? '电脑端' : '手机端'} · {ASSETS[selectedKey].label}
                </strong>
                <RangeRow
                  label="X"
                  value={selected.x}
                  min={0}
                  max={100}
                  step={0.5}
                  suffix="%"
                  onChange={(value) => updateSelected('x', value)}
                />
                <RangeRow
                  label="Y"
                  value={selected.y}
                  min={0}
                  max={100}
                  step={0.5}
                  suffix="%"
                  onChange={(value) => updateSelected('y', value)}
                />
                <RangeRow
                  label="Size"
                  value={selected.width}
                  min={5}
                  max={95}
                  step={0.5}
                  suffix="%"
                  onChange={(value) => updateSelected('width', value)}
                />
              </section>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  marginTop: 16,
                }}
              >
                <button type="button" style={{ ...smallButtonStyle, background: '#f8e8ee' }} onClick={copySettings}>
                  {copyStatus}
                </button>
                <button
                  type="button"
                  style={smallButtonStyle}
                  onClick={resetCurrentProfile}
                >
                  恢复当前端
                </button>
              </div>

              <p style={{ margin: '10px 0 0', fontSize: 10, lineHeight: 1.5, color: '#aa8c96' }}>
                电脑端和手机端都会保存在同一个调试配置中。全部调好后点“复制双端参数”发给我即可固化。
              </p>
            </div>
          )}
        </aside>
      )}
    </main>
  )
}
