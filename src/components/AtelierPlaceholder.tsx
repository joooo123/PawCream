import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type DeviceProfile = 'desktop' | 'mobile'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

type AssetKey =
  | 'window'
  | 'pawcream'
  | 'cabinet'
  | 'people'
  | 'light'
  | 'message'
  | 'instax'
  | 'sewing'
  | 'note'
  | 'bear'

type AssetLayout = {
  x: number
  y: number
  width: number
}

type AtelierTuning = Record<AssetKey, AssetLayout>
type AtelierProfiles = Record<DeviceProfile, AtelierTuning>

const STORAGE_KEY = 'pawcream-atelier-tuning-v2'
const LEGACY_STORAGE_KEY = 'pawcream-atelier-tuning-v1'

const ASSETS: Record<AssetKey, { src: string; label: string; zIndex: number }> = {
  window: {
    src: `${import.meta.env.BASE_URL}assets/atelier/window.png`,
    label: 'Window',
    zIndex: 1,
  },
  pawcream: {
    src: `${import.meta.env.BASE_URL}assets/atelier/pawcream.png`,
    label: 'PawCream',
    zIndex: 1,
  },
  cabinet: {
    src: `${import.meta.env.BASE_URL}assets/atelier/wall-mounted%20cabinet.png`,
    label: 'Wall cabinet',
    zIndex: 2,
  },
  people: {
    src: `${import.meta.env.BASE_URL}assets/atelier/people.png`,
    label: 'People',
    zIndex: 3,
  },
  light: {
    src: `${import.meta.env.BASE_URL}assets/atelier/light.png`,
    label: 'Light',
    zIndex: 4,
  },
  message: {
    src: `${import.meta.env.BASE_URL}assets/atelier/message.png`,
    label: 'Message',
    zIndex: 5,
  },
  instax: {
    src: `${import.meta.env.BASE_URL}assets/atelier/instax.png`,
    label: 'Instax',
    zIndex: 6,
  },
  sewing: {
    src: `${import.meta.env.BASE_URL}assets/atelier/sewing%20machine.png`,
    label: 'Sewing machine',
    zIndex: 7,
  },
  note: {
    src: `${import.meta.env.BASE_URL}assets/atelier/note.png?v=517196166abc61e4216196dc5b317b39c36d2c86`,
    label: 'Note',
    zIndex: 8,
  },
  bear: {
    src: `${import.meta.env.BASE_URL}assets/atelier/bear.png?v=3f981c19b7b4bc06c34a4cfb27bf86e50dd0cb06`,
    label: 'Bear',
    zIndex: 9,
  },
}

const ASSET_ORDER: AssetKey[] = [
  'window',
  'pawcream',
  'cabinet',
  'people',
  'light',
  'message',
  'instax',
  'sewing',
  'note',
  'bear',
]

const STANDARD_ASSET_ORDER: AssetKey[] = [
  'cabinet',
  'people',
  'light',
  'message',
  'instax',
  'sewing',
  'note',
  'bear',
]

const ATELIER_TUNING_DEFAULTS: AtelierProfiles = {
  desktop: {
    window: { x: 21.3, y: 27, width: 39 },
    pawcream: { x: 21.3, y: 27, width: 39 },
    cabinet: { x: 80.6, y: 17.6, width: 33.5 },
    people: { x: 64.6, y: 47.1, width: 9.5 },
    light: { x: 50.6, y: 19.8, width: 21.5 },
    message: { x: 48.8, y: 70.6, width: 28.5 },
    instax: { x: 31.5, y: 66, width: 31 },
    sewing: { x: 85.2, y: 48.4, width: 42 },
    note: { x: 9, y: 67.4, width: 38.5 },
    bear: { x: 96.5, y: 89.4, width: 9.5 },
  },
  mobile: {
    window: { x: 31.3, y: 27.3, width: 95 },
    pawcream: { x: 31.3, y: 27.3, width: 95 },
    cabinet: { x: 66, y: 38.5, width: 90 },
    people: { x: 32.5, y: 51.1, width: 27 },
    light: { x: 79.5, y: 15.4, width: 70.5 },
    message: { x: 25.4, y: 80.1, width: 63.5 },
    instax: { x: 83.1, y: 78, width: 57.5 },
    sewing: { x: 74, y: 53.6, width: 74 },
    note: { x: 14.6, y: 50.1, width: 80 },
    bear: { x: 16, y: 66.5, width: 22.5 },
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
  return ASSET_ORDER.reduce((next, key) => {
    next[key] = { ...source[key] }
    return next
  }, {} as AtelierTuning)
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
      const parsed = JSON.parse(raw) as Partial<
        Record<DeviceProfile, Partial<Record<AssetKey, Partial<AssetLayout>>>>
      >
      return {
        desktop: mergeLayout(parsed.desktop, ATELIER_TUNING_DEFAULTS.desktop),
        mobile: mergeLayout(parsed.mobile, ATELIER_TUNING_DEFAULTS.mobile),
      }
    }

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
      <output
        style={{
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          color: '#a17f8a',
        }}
      >
        {value.toFixed(step < 1 ? 1 : 0)}{suffix}
      </output>
    </label>
  )
}

export default function AtelierPlaceholder({
  onBack,
  deviceProfile,
  onDeviceChange,
  mobilePreview,
}: Props) {
  const artboardRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<{ key: AssetKey; pointerId: number } | null>(null)

  const tuneMode = useMemo(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('tune') === '1',
    [],
  )

  const [tuning, setTuning] = useState<AtelierProfiles>(() => loadTuning(tuneMode))
  const [selectedKey, setSelectedKey] = useState<AssetKey>('bear')
  const [collapsed, setCollapsed] = useState(false)
  const [copyStatus, setCopyStatus] = useState('复制双端参数')
  const [windowHovered, setWindowHovered] = useState(false)

  useEffect(() => {
    if (!tuneMode) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tuning))
  }, [tuneMode, tuning])

  useEffect(() => {
    setWindowHovered(false)
  }, [deviceProfile])

  const renderTuning = tuning[deviceProfile]
  const selected = renderTuning[selectedKey]
  const mobile = deviceProfile === 'mobile'
  const pairSelected = selectedKey === 'window' || selectedKey === 'pawcream'
  const showPawcream = mobile || (tuneMode && pairSelected
    ? selectedKey === 'pawcream'
    : windowHovered)

  const updateSelected = (field: keyof AssetLayout, value: number) => {
    setTuning((current) => {
      const profile = current[deviceProfile]

      if (pairSelected) {
        return {
          ...current,
          [deviceProfile]: {
            ...profile,
            window: { ...profile.window, [field]: value },
            pawcream: { ...profile.pawcream, [field]: value },
          },
        }
      }

      return {
        ...current,
        [deviceProfile]: {
          ...profile,
          [selectedKey]: { ...profile[selectedKey], [field]: value },
        },
      }
    })
  }

  const moveAssetFromPointer = (key: AssetKey, clientX: number, clientY: number) => {
    const artboard = artboardRef.current
    if (!artboard) return

    const rect = artboard.getBoundingClientRect()
    const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)
    const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100)
    const nextX = Number(x.toFixed(1))
    const nextY = Number(y.toFixed(1))
    const syncPair = key === 'window' || key === 'pawcream'

    setTuning((current) => {
      const profile = current[deviceProfile]

      if (syncPair) {
        return {
          ...current,
          [deviceProfile]: {
            ...profile,
            window: { ...profile.window, x: nextX, y: nextY },
            pawcream: { ...profile.pawcream, x: nextX, y: nextY },
          },
        }
      }

      return {
        ...current,
        [deviceProfile]: {
          ...profile,
          [key]: { ...profile[key], x: nextX, y: nextY },
        },
      }
    })
  }

  const onAssetPointerDown = (
    key: AssetKey,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
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
      [deviceProfile]: cloneLayout(ATELIER_TUNING_DEFAULTS[deviceProfile]),
    }))
    setSelectedKey('bear')
    setWindowHovered(false)
  }

  const stageStyle: CSSProperties = mobile
    ? {
        position: 'relative',
        width: mobilePreview ? 390 : '100vw',
        height: mobilePreview ? 844 : '100svh',
        minHeight: mobilePreview ? 844 : '100svh',
        maxWidth: 'none',
        overflow: 'hidden',
        background: '#ffffff',
      }
    : {
        position: 'relative',
        width: '100vw',
        height: '100svh',
        minHeight: '100svh',
        maxWidth: 'none',
        overflow: 'hidden',
        background: '#ffffff',
      }

  const renderAsset = (key: AssetKey) => {
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
          outline: selectedAsset
            ? '1.5px dashed rgba(213, 111, 157, 0.9)'
            : 'none',
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
  }

  const pairLayout = renderTuning.window
  const pairSelectedOutline = tuneMode && pairSelected
  const pairDragKey: AssetKey = pairSelected
    ? selectedKey
    : showPawcream
      ? 'pawcream'
      : 'window'

  const stage = (
    <section
      ref={artboardRef}
      aria-label={`PawCream Atelier Room ${deviceProfile} layout`}
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
          {mobile ? 'Mobile phone · 390 × 844' : 'Desktop · full viewport'}
        </span>
      )}

      <div
        role={tuneMode ? 'button' : undefined}
        tabIndex={tuneMode ? 0 : undefined}
        aria-label={tuneMode ? `Move ${showPawcream ? 'PawCream' : 'Window'}` : undefined}
        onMouseEnter={() => {
          if (!mobile && !(tuneMode && pairSelected)) setWindowHovered(true)
        }}
        onMouseLeave={() => {
          if (!mobile && !(tuneMode && pairSelected)) setWindowHovered(false)
        }}
        onPointerDown={(event) => onAssetPointerDown(pairDragKey, event)}
        onPointerMove={onAssetPointerMove}
        onPointerUp={onAssetPointerUp}
        onPointerCancel={onAssetPointerUp}
        onClick={() => {
          if (!tuneMode) return
          setSelectedKey(showPawcream ? 'pawcream' : 'window')
        }}
        style={{
          position: 'absolute',
          left: `${pairLayout.x}%`,
          top: `${pairLayout.y}%`,
          width: `${pairLayout.width}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: ASSETS.window.zIndex,
          cursor: tuneMode ? 'grab' : mobile ? 'default' : 'pointer',
          touchAction: tuneMode ? 'none' : 'auto',
          userSelect: 'none',
          outline: pairSelectedOutline
            ? '1.5px dashed rgba(213, 111, 157, 0.9)'
            : 'none',
          outlineOffset: pairSelectedOutline ? 6 : 0,
          borderRadius: pairSelectedOutline ? 10 : 0,
        }}
      >
        <img
          key={showPawcream ? 'pawcream' : 'window'}
          src={showPawcream ? ASSETS.pawcream.src : ASSETS.window.src}
          alt={showPawcream ? ASSETS.pawcream.label : ASSETS.window.label}
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

        {pairSelectedOutline && (
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
            {showPawcream ? 'PawCream' : 'Window'} · linked position
          </span>
        )}
      </div>

      {STANDARD_ASSET_ORDER.map(renderAsset)}
    </section>
  )

  return (
    <main
      style={{
        minHeight: mobilePreview ? 940 : '100svh',
        display: mobilePreview ? 'block' : 'grid',
        placeItems: mobilePreview ? undefined : 'center',
        overflowX: 'hidden',
        overflowY: mobilePreview ? 'auto' : 'hidden',
        background: mobilePreview ? '#fbf9fa' : '#ffffff',
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
          zIndex: 65,
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

      {mobilePreview ? (
        <div
          style={{
            width: 'calc(100% - 380px)',
            minWidth: 470,
            minHeight: 940,
            display: 'grid',
            placeItems: 'center',
            padding: '32px 24px',
          }}
        >
          <div className="mobile-device-shell">
            <div className="mobile-reference-label" aria-hidden="true">
              Atelier phone preview · 390 × 844 CSS px
            </div>
            <div className="mobile-device-screen">
              <div className="mobile-device-island" aria-hidden="true" />
              <div className="mobile-device-home-indicator" aria-hidden="true" />
              {stage}
            </div>
          </div>
        </div>
      ) : stage}

      {tuneMode && (
        <aside style={{ ...panelStyle, width: collapsed ? 220 : panelStyle.width }}>
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              padding: '13px 14px 12px 16px',
              borderBottom: collapsed
                ? 0
                : '1px solid rgba(198, 133, 157, 0.15)',
            }}
          >
            <div>
              <strong style={{ display: 'block', fontSize: 13 }}>Atelier Tune</strong>
              <span style={{ fontSize: 10, color: '#aa8c96' }}>
                电脑端 / 手机端 独立布局
              </span>
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
            <div
              style={{
                maxHeight: 'calc(100svh - 92px)',
                overflowY: 'auto',
                padding: '14px 16px 16px',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  lineHeight: 1.55,
                  color: '#947a83',
                }}
              >
                Desktop：Window 默认显示，悬停切换 PawCream。Mobile：直接显示 PawCream。Window 与 PawCream 的位置和大小联动。
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
                    onClick={() => onDeviceChange(profile)}
                    style={{
                      ...smallButtonStyle,
                      minHeight: 38,
                      fontWeight: 650,
                      background:
                        deviceProfile === profile
                          ? 'rgba(248, 232, 238, 0.98)'
                          : 'rgba(255,255,255,0.78)',
                      borderColor:
                        deviceProfile === profile
                          ? 'rgba(213, 111, 157, 0.55)'
                          : 'rgba(198, 133, 157, 0.24)',
                    }}
                  >
                    {profile === 'desktop'
                      ? '电脑端 · 全屏'
                      : '手机端 · 390×844'}
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
                        selectedKey === key
                          ? 'rgba(248, 232, 238, 0.98)'
                          : 'rgba(255,255,255,0.78)',
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

              {pairSelected && (
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: 10,
                    lineHeight: 1.5,
                    color: '#aa8c96',
                  }}
                >
                  Window / PawCream 为同一交互位置。调整任意一个都会同步另一张图；点击两个按钮可切换调试时显示状态。
                </p>
              )}

              <section
                style={{
                  marginTop: 15,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(198, 133, 157, 0.13)',
                }}
              >
                <strong style={{ display: 'block', marginBottom: 7, fontSize: 11 }}>
                  {deviceProfile === 'desktop' ? '电脑端' : '手机端'} · {ASSETS[selectedKey].label}
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
                <button
                  type="button"
                  style={{ ...smallButtonStyle, background: '#f8e8ee' }}
                  onClick={copySettings}
                >
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

              <p
                style={{
                  margin: '10px 0 0',
                  fontSize: 10,
                  lineHeight: 1.5,
                  color: '#aa8c96',
                }}
              >
                10 个素材都会保存在双端调试配置中。Bear、Note 和 Wall cabinet 都可独立拖动并调节 X / Y / Size。
              </p>
            </div>
          )}
        </aside>
      )}
    </main>
  )
}
