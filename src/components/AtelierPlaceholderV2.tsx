import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type DeviceProfile = 'desktop' | 'mobile'
type Language = 'zh' | 'en'

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
  | 'music'
  | 'color'

type AssetLayout = {
  x: number
  y: number
  width: number
  rotation: number
}

type AtelierTuning = Record<AssetKey, AssetLayout>
type AtelierProfiles = Record<DeviceProfile, AtelierTuning>

type BoardMessage = {
  id: string
  text: string
  createdAt: number
}

const STORAGE_KEY = 'pawcream-atelier-tuning-v5'
const PREVIOUS_STORAGE_KEY = 'pawcream-atelier-tuning-v4'
const LANGUAGE_STORAGE_KEY = 'pawcream-language-v1'
const BOARD_STORAGE_KEY = 'pawcream-message-board-v1'
const BACKGROUND_STORAGE_KEY = 'pawcream-atelier-background-v1'

const BACKGROUND_URLS = [
  `${import.meta.env.BASE_URL}assets/atelier/background.png?v=490fae2d4e560f1ab427c535f2caa0f59efd27f8`,
  `${import.meta.env.BASE_URL}assets/atelier/background2.png?v=952b5d1b813f6a6872b54a509847dc5ce6e96879`,
  `${import.meta.env.BASE_URL}assets/atelier/background3.png?v=8e09df228690d4971861a7b18d1b10a88199e12e`,
] as const

const ASSETS: Record<AssetKey, { src: string; label: string; zIndex: number }> = {
  window: { src: `${import.meta.env.BASE_URL}assets/atelier/window.png`, label: 'Window', zIndex: 1 },
  pawcream: { src: `${import.meta.env.BASE_URL}assets/atelier/pawcream.png`, label: 'PawCream', zIndex: 1 },
  cabinet: { src: `${import.meta.env.BASE_URL}assets/atelier/wall-mounted%20cabinet.png`, label: 'Wall cabinet', zIndex: 2 },
  people: { src: `${import.meta.env.BASE_URL}assets/atelier/people.png`, label: 'People', zIndex: 3 },
  light: { src: `${import.meta.env.BASE_URL}assets/atelier/light.png`, label: 'Light', zIndex: 4 },
  instax: { src: `${import.meta.env.BASE_URL}assets/atelier/instax.png`, label: 'Instax', zIndex: 6 },
  sewing: { src: `${import.meta.env.BASE_URL}assets/atelier/sewing%20machine.png`, label: 'Sewing machine', zIndex: 7 },
  bear: { src: `${import.meta.env.BASE_URL}assets/atelier/bear.png?v=c9b3f50b5ee19c81b5bcd761a739cb6e7b8a7ca1`, label: 'Bear', zIndex: 9 },
  music: { src: `${import.meta.env.BASE_URL}assets/atelier/music.png?v=c33cc962958420cb7d90922e25b09847446f27a1`, label: 'Music', zIndex: 10 },
  note: { src: `${import.meta.env.BASE_URL}assets/atelier/note.png?v=517196166abc61e4216196dc5b317b39c36d2c86`, label: 'Note', zIndex: 11 },
  message: { src: `${import.meta.env.BASE_URL}assets/atelier/message.png`, label: 'Message', zIndex: 12 },
  color: { src: `${import.meta.env.BASE_URL}assets/atelier/color.png?v=7f85d4bc59223223e05171ccc40e4009d1f99529`, label: 'Color', zIndex: 13 },
}

const ASSET_ORDER: AssetKey[] = [
  'window', 'pawcream', 'cabinet', 'people', 'light', 'message',
  'instax', 'sewing', 'note', 'bear', 'music', 'color',
]

const STANDARD_ASSET_ORDER: AssetKey[] = [
  'cabinet', 'people', 'light', 'instax', 'sewing', 'bear',
  'music', 'note', 'message', 'color',
]

const L = (x: number, y: number, width: number, rotation = 0): AssetLayout => ({
  x, y, width, rotation,
})

const ATELIER_TUNING_DEFAULTS: AtelierProfiles = {
  desktop: {
    window: L(13.7, 17.9, 39, 0),
    pawcream: L(13.7, 17.9, 39, 0),
    cabinet: L(78, 20.5, 33.5, 0),
    people: L(64.6, 47.1, 9.5, 0),
    light: L(52, 9, 21.5, 0),
    message: L(7.8, 65.5, 27, 0),
    instax: L(31.5, 66, 31, 0),
    sewing: L(85.2, 48.4, 42, 0),
    note: L(9, 67.4, 38.5, 0),
    bear: L(96.5, 89.4, 9.5, 0),
    music: L(37, 40.7, 38, 0),
    color: L(81.5, 16.5, 30, -89),
  },
  mobile: {
    window: L(31.5, 17, 95, 0),
    pawcream: L(31.5, 17, 95, 0),
    cabinet: L(74.5, 38.5, 90, 0),
    people: L(36, 50.5, 21.5, 0),
    light: L(81.5, 14.8, 70.5, 0),
    message: L(18.5, 68, 55.5, 0),
    instax: L(51, 86.3, 68.5, 7),
    sewing: L(74.9, 53.4, 74, 0),
    note: L(20.5, 69, 83.5, 0),
    bear: L(83.5, 75.5, 30.5, 11),
    music: L(35.5, 36.3, 93.5, 0),
    color: L(84, 36.5, 83, -89),
  },
}

const panelStyle: CSSProperties = {
  position: 'fixed', top: 18, right: 18, zIndex: 70,
  width: 'min(350px, calc(100vw - 36px))', maxHeight: 'calc(100svh - 36px)',
  overflow: 'hidden', border: '1px solid rgba(198, 133, 157, 0.28)',
  borderRadius: 20, background: 'rgba(255, 252, 253, 0.94)',
  boxShadow: '0 18px 50px rgba(113, 81, 91, 0.12)',
  backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
  color: '#745f66', fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const smallButtonStyle: CSSProperties = {
  minHeight: 32, border: '1px solid rgba(198, 133, 157, 0.24)', borderRadius: 11,
  background: 'rgba(255,255,255,0.78)', color: '#876974', cursor: 'pointer', fontSize: 11,
}

const uiFont = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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
      width: typeof item.width === 'number' && Number.isFinite(item.width) ? item.width : current.width,
      rotation: typeof item.rotation === 'number' && Number.isFinite(item.rotation) ? item.rotation : current.rotation,
    }
  }
  return next
}

function loadTuning(enabled: boolean): AtelierProfiles {
  if (!enabled || typeof window === 'undefined') return cloneDefaults()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(PREVIOUS_STORAGE_KEY)
    if (!raw) return cloneDefaults()
    const parsed = JSON.parse(raw) as Partial<Record<DeviceProfile, Partial<Record<AssetKey, Partial<AssetLayout>>>>>
    return {
      desktop: mergeLayout(parsed.desktop, ATELIER_TUNING_DEFAULTS.desktop),
      mobile: mergeLayout(parsed.mobile, ATELIER_TUNING_DEFAULTS.mobile),
    }
  } catch {
    return cloneDefaults()
  }
}

function loadLanguage(): Language {
  if (typeof window === 'undefined') return 'zh'
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh'
}

function loadBoardMessages(): BoardMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(BOARD_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BoardMessage[]
    return Array.isArray(parsed) ? parsed.slice(0, 20) : []
  } catch {
    return []
  }
}

function loadBackgroundIndex() {
  if (typeof window === 'undefined') return 0
  const value = Number(window.localStorage.getItem(BACKGROUND_STORAGE_KEY))
  return Number.isInteger(value) && value >= 0 && value < BACKGROUND_URLS.length ? value : 0
}

function RangeRow({ label, value, min, max, step, suffix, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '64px 1fr 58px', alignItems: 'center', gap: 8, minHeight: 32, fontSize: 11 }}>
      <span>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        style={{ width: '100%', accentColor: '#d58da8', cursor: 'ew-resize' }}
      />
      <output style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#a17f8a' }}>
        {value.toFixed(step < 1 ? 1 : 0)}{suffix}
      </output>
    </label>
  )
}

export default function AtelierPlaceholderV2({ onBack, deviceProfile, onDeviceChange, mobilePreview }: Props) {
  const artboardRef = useRef<HTMLElement | null>(null)
  const tuneDragRef = useRef<{ key: AssetKey; pointerId: number } | null>(null)
  const messageDragRef = useRef<{ pointerId: number } | null>(null)
  const hitCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const tuneMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tune') === '1',
    [],
  )

  const [tuning, setTuning] = useState<AtelierProfiles>(() => loadTuning(tuneMode))
  const [selectedKey, setSelectedKey] = useState<AssetKey>('music')
  const [collapsed, setCollapsed] = useState(false)
  const [copyStatus, setCopyStatus] = useState('复制双端参数')
  const [windowHovered, setWindowHovered] = useState(false)
  const [backgroundIndex, setBackgroundIndex] = useState(loadBackgroundIndex)

  const [language, setLanguage] = useState<Language>(loadLanguage)
  const [topBarOpen, setTopBarOpen] = useState(false)
  const [hintMode, setHintMode] = useState(false)
  const [messageMoveMode, setMessageMoveMode] = useState(false)
  const [runtimeMessagePosition, setRuntimeMessagePosition] = useState<{ x: number; y: number } | null>(null)
  const [boardOpen, setBoardOpen] = useState(false)
  const [boardDraft, setBoardDraft] = useState('')
  const [boardMessages, setBoardMessages] = useState<BoardMessage[]>(loadBoardMessages)
  const [loginNoticeOpen, setLoginNoticeOpen] = useState(false)

  const copy = language === 'zh'
    ? {
        notePrompt: '留下你想对 PawCream 说的话吧',
        messageHint: '拖动这封信',
        lightHint: '打开工具栏',
        toolbarHint: '提示', toolbarHome: '返回 Home', toolbarLogin: '登入', toolbarClose: '收起',
        boardTitle: 'PawCream 留言板', boardSubtitle: '写下一句话，留在这间小小的工作室里。',
        boardPlaceholder: '想对 PawCream 说点什么？', boardSubmit: '贴上留言', boardEmpty: '这里还没有留言。',
        boardLocal: '当前留言保存在此浏览器中。', loginTitle: '登入',
        loginBody: '账号系统还没有接入。这个入口已经预留，后续可以连接真实账号与云端留言。', close: '关闭',
      }
    : {
        notePrompt: 'Leave a little note for PawCream',
        messageHint: 'Drag this letter', lightHint: 'Open toolbar',
        toolbarHint: 'Hints', toolbarHome: 'Home', toolbarLogin: 'Sign in', toolbarClose: 'Hide',
        boardTitle: 'PawCream Message Board', boardSubtitle: 'Leave a small thought in this tiny atelier.',
        boardPlaceholder: 'What would you like to tell PawCream?', boardSubmit: 'Leave note', boardEmpty: 'No notes here yet.',
        boardLocal: 'Messages are currently stored in this browser.', loginTitle: 'Sign in',
        loginBody: 'The account system is not connected yet. This entry point is ready for real accounts and cloud messages later.', close: 'Close',
      }

  useEffect(() => {
    if (!tuneMode) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tuning))
  }, [tuneMode, tuning])

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }, [language])

  useEffect(() => {
    window.localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(boardMessages))
  }, [boardMessages])

  useEffect(() => {
    document.documentElement.style.setProperty('--atelier-background-image', `url("${BACKGROUND_URLS[backgroundIndex]}")`)
    window.localStorage.setItem(BACKGROUND_STORAGE_KEY, String(backgroundIndex))
  }, [backgroundIndex])

  useEffect(() => {
    setWindowHovered(false)
    setRuntimeMessagePosition(null)
    setMessageMoveMode(false)
  }, [deviceProfile])

  useEffect(() => {
    if (!tuneMode) return
    document.documentElement.classList.add('pawcream-tune-lights-off')
    const style = document.createElement('style')
    style.dataset.pawcreamTuneLightsOff = 'true'
    style.textContent = `
      html.pawcream-tune-lights-off section[aria-label^="PawCream Atelier Room"]::after { opacity: 0 !important; }
      html.pawcream-tune-lights-off .atelier-lightline-layer { display: none !important; opacity: 0 !important; }
      html.pawcream-tune-lights-off .lightline-tune-panel { display: none !important; }
    `
    document.head.appendChild(style)
    return () => {
      document.documentElement.classList.remove('pawcream-tune-lights-off')
      style.remove()
    }
  }, [tuneMode])

  const renderTuning = tuning[deviceProfile]
  const selected = renderTuning[selectedKey]
  const mobile = deviceProfile === 'mobile'
  const pairSelected = selectedKey === 'window' || selectedKey === 'pawcream'
  const showPawcream = mobile || (tuneMode && pairSelected ? selectedKey === 'pawcream' : windowHovered)

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

  const pointToPercent = (clientX: number, clientY: number) => {
    const artboard = artboardRef.current
    if (!artboard) return null
    const rect = artboard.getBoundingClientRect()
    return {
      x: Number(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100).toFixed(1)),
      y: Number(clamp(((clientY - rect.top) / rect.height) * 100, 0, 100).toFixed(1)),
    }
  }

  const moveAssetFromPointer = (key: AssetKey, clientX: number, clientY: number) => {
    const point = pointToPercent(clientX, clientY)
    if (!point) return
    const syncPair = key === 'window' || key === 'pawcream'
    setTuning((current) => {
      const profile = current[deviceProfile]
      if (syncPair) {
        return {
          ...current,
          [deviceProfile]: {
            ...profile,
            window: { ...profile.window, x: point.x, y: point.y },
            pawcream: { ...profile.pawcream, x: point.x, y: point.y },
          },
        }
      }
      return {
        ...current,
        [deviceProfile]: {
          ...profile,
          [key]: { ...profile[key], x: point.x, y: point.y },
        },
      }
    })
  }

  const moveRuntimeMessage = (clientX: number, clientY: number) => {
    const point = pointToPercent(clientX, clientY)
    if (point) setRuntimeMessagePosition(point)
  }

  const onAssetPointerDown = (key: AssetKey, event: ReactPointerEvent<HTMLDivElement>) => {
    if (tuneMode) {
      setSelectedKey(key)
      tuneDragRef.current = { key, pointerId: event.pointerId }
      event.currentTarget.setPointerCapture(event.pointerId)
      moveAssetFromPointer(key, event.clientX, event.clientY)
      return
    }
    if (key === 'message') {
      setMessageMoveMode(true)
      messageDragRef.current = { pointerId: event.pointerId }
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const onAssetPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const tuneDrag = tuneDragRef.current
    if (tuneDrag?.pointerId === event.pointerId) {
      moveAssetFromPointer(tuneDrag.key, event.clientX, event.clientY)
      return
    }
    if (messageDragRef.current?.pointerId === event.pointerId) {
      moveRuntimeMessage(event.clientX, event.clientY)
    }
  }

  const onAssetPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (tuneDragRef.current?.pointerId === event.pointerId) tuneDragRef.current = null
    if (messageDragRef.current?.pointerId === event.pointerId) messageDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleNormalAssetClick = (key: AssetKey) => {
    if (tuneMode) {
      setSelectedKey(key)
      return
    }
    if (key === 'message') {
      setMessageMoveMode(true)
      return
    }
    if (key === 'light') {
      const nextOpen = !topBarOpen
      setTopBarOpen(nextOpen)
      setHintMode(nextOpen)
      if (!nextOpen) setLoginNoticeOpen(false)
      return
    }
    if (key === 'color') {
      setBackgroundIndex((index) => (index + 1) % BACKGROUND_URLS.length)
    }
  }

  const noteOpaqueAt = (clientX: number, clientY: number) => {
    const stage = artboardRef.current
    if (!stage) return false
    const image = stage.querySelector<HTMLImageElement>('img[alt="Note"]')
    if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) return false

    const layout = renderTuning.note
    const rect = stage.getBoundingClientRect()
    const centerX = rect.left + (layout.x / 100) * rect.width
    const centerY = rect.top + (layout.y / 100) * rect.height
    const renderWidth = (layout.width / 100) * rect.width
    const renderHeight = renderWidth * (image.naturalHeight / image.naturalWidth)
    const dx = clientX - centerX
    const dy = clientY - centerY
    const angle = (-layout.rotation * Math.PI) / 180
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle)
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle)
    const nx = (localX + renderWidth / 2) / renderWidth
    const ny = (localY + renderHeight / 2) / renderHeight
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return false

    try {
      const canvas = hitCanvasRef.current ?? document.createElement('canvas')
      hitCanvasRef.current = canvas
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return false
      ctx.clearRect(0, 0, 1, 1)
      const sx = clamp(Math.floor(nx * image.naturalWidth), 0, image.naturalWidth - 1)
      const sy = clamp(Math.floor(ny * image.naturalHeight), 0, image.naturalHeight - 1)
      ctx.drawImage(image, sx, sy, 1, 1, 0, 0, 1, 1)
      return ctx.getImageData(0, 0, 1, 1).data[3] >= 40
    } catch {
      return false
    }
  }

  const handleStageClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (tuneMode || boardOpen || !messageMoveMode) return
    if (noteOpaqueAt(event.clientX, event.clientY)) setBoardOpen(true)
  }

  const copySettings = async () => {
    const text = `ATELIER_TUNING_DEFAULTS = ${JSON.stringify(tuning, null, 2)}`
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('已复制')
    } catch {
      setCopyStatus('复制失败')
    }
    window.setTimeout(() => setCopyStatus('复制双端参数'), 1300)
  }

  const resetCurrentProfile = () => {
    setTuning((current) => ({ ...current, [deviceProfile]: cloneLayout(ATELIER_TUNING_DEFAULTS[deviceProfile]) }))
    setSelectedKey('music')
    setWindowHovered(false)
  }

  const submitBoardMessage = () => {
    const text = boardDraft.trim()
    if (!text) return
    setBoardMessages((current) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: text.slice(0, 280), createdAt: Date.now() }, ...current].slice(0, 20))
    setBoardDraft('')
  }

  const closeToolbar = () => {
    setTopBarOpen(false)
    setHintMode(false)
    setLoginNoticeOpen(false)
  }

  const stageStyle: CSSProperties = {
    position: 'relative',
    width: mobile ? (mobilePreview ? 390 : '100vw') : '100vw',
    height: mobile ? (mobilePreview ? 844 : '100svh') : '100svh',
    minHeight: mobile ? (mobilePreview ? 844 : '100svh') : '100svh',
    maxWidth: 'none', overflow: 'hidden', background: '#ffffff',
  }

  const renderAsset = (key: AssetKey) => {
    const asset = ASSETS[key]
    const baseLayout = renderTuning[key]
    const layout = !tuneMode && key === 'message' && runtimeMessagePosition
      ? { ...baseLayout, ...runtimeMessagePosition }
      : baseLayout
    const selectedAsset = tuneMode && selectedKey === key
    const noteIsPassive = !tuneMode && key === 'note'
    const interactive = !tuneMode && (key === 'message' || key === 'light' || key === 'color')
    const movingMessage = !tuneMode && key === 'message' && messageMoveMode
    const hintText = !hintMode || tuneMode
      ? null
      : key === 'message'
        ? copy.messageHint
        : key === 'light'
          ? copy.lightHint
          : null

    return (
      <div
        key={key}
        role={tuneMode || interactive ? 'button' : undefined}
        tabIndex={tuneMode || interactive ? 0 : undefined}
        aria-label={tuneMode ? `Move ${asset.label}` : interactive ? `${asset.label} interaction` : undefined}
        onPointerDown={(event) => onAssetPointerDown(key, event)}
        onPointerMove={onAssetPointerMove}
        onPointerUp={onAssetPointerUp}
        onPointerCancel={onAssetPointerUp}
        onClick={(event) => {
          if (noteIsPassive) return
          event.stopPropagation()
          handleNormalAssetClick(key)
        }}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && (tuneMode || interactive)) {
            event.preventDefault()
            handleNormalAssetClick(key)
          }
        }}
        style={{
          position: 'absolute', left: `${layout.x}%`, top: `${layout.y}%`, width: `${layout.width}%`,
          transform: `translate(-50%, -50%) rotate(${layout.rotation}deg)`, transformOrigin: '50% 50%',
          zIndex: asset.zIndex,
          cursor: tuneMode ? 'grab' : key === 'message' ? (movingMessage ? 'move' : 'grab') : interactive ? 'pointer' : 'default',
          touchAction: tuneMode || key === 'message' ? 'none' : 'auto', userSelect: 'none',
          pointerEvents: noteIsPassive ? 'none' : undefined,
          outline: selectedAsset ? '1.5px dashed rgba(213, 111, 157, 0.9)' : 'none',
          outlineOffset: selectedAsset ? 6 : 0, borderRadius: selectedAsset ? 10 : 0,
        }}
      >
        <img
          src={asset.src} alt={asset.label} draggable={false} decoding="async"
          style={{ display: 'block', width: '100%', height: 'auto', pointerEvents: 'none', userSelect: 'none' }}
        />

        {selectedAsset && (
          <span style={{ position: 'absolute', left: '50%', top: -27, transform: `translateX(-50%) rotate(${-layout.rotation}deg)`, padding: '3px 7px', borderRadius: 999, background: 'rgba(255, 249, 252, 0.96)', color: '#a4687f', fontSize: 10, fontFamily: uiFont, boxShadow: '0 4px 14px rgba(113,81,91,.1)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
            {asset.label}
          </span>
        )}

        {hintText && (
          <span style={{ position: 'absolute', left: '50%', top: -34, transform: `translateX(-50%) rotate(${-layout.rotation}deg)`, padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(213,141,168,.2)', background: 'rgba(255,251,253,.94)', color: '#986d7d', fontFamily: uiFont, fontSize: mobile ? 9 : 11, lineHeight: 1, boxShadow: '0 6px 20px rgba(114,82,93,.1)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
            {hintText}
          </span>
        )}

        {!tuneMode && key === 'note' && messageMoveMode && (
          <span style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) rotate(${-layout.rotation}deg)`, width: mobile ? '58%' : '48%', maxWidth: 220, padding: mobile ? '8px 10px' : '10px 13px', borderRadius: 14, border: '1px solid rgba(215,151,174,.18)', background: 'rgba(255,252,253,.9)', color: '#946d7a', fontFamily: uiFont, fontSize: mobile ? 9 : 11, lineHeight: 1.5, textAlign: 'center', boxShadow: '0 8px 26px rgba(113,81,91,.11)', pointerEvents: 'none' }}>
            {copy.notePrompt}
          </span>
        )}
      </div>
    )
  }

  const pairLayout = renderTuning.window
  const pairSelectedOutline = tuneMode && pairSelected
  const pairDragKey: AssetKey = pairSelected ? selectedKey : showPawcream ? 'pawcream' : 'window'

  const stage = (
    <section
      ref={artboardRef}
      aria-label={`PawCream Atelier Room ${deviceProfile} layout`}
      style={stageStyle}
      onClick={handleStageClick}
    >
      <h1 style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>PawCream Atelier Room</h1>

      {tuneMode && (
        <span style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 50, padding: '4px 8px', borderRadius: 999, background: 'rgba(255,249,252,.9)', color: '#a4687f', fontFamily: uiFont, fontSize: 10, pointerEvents: 'none' }}>
          {mobile ? 'Mobile phone · 390 × 844 · Light OFF' : 'Desktop · full viewport · Light OFF'}
        </span>
      )}

      <div
        role={tuneMode ? 'button' : undefined}
        tabIndex={tuneMode ? 0 : undefined}
        aria-label={tuneMode ? `Move ${showPawcream ? 'PawCream' : 'Window'}` : undefined}
        onMouseEnter={() => { if (!mobile && !(tuneMode && pairSelected)) setWindowHovered(true) }}
        onMouseLeave={() => { if (!mobile && !(tuneMode && pairSelected)) setWindowHovered(false) }}
        onPointerDown={(event) => onAssetPointerDown(pairDragKey, event)}
        onPointerMove={onAssetPointerMove}
        onPointerUp={onAssetPointerUp}
        onPointerCancel={onAssetPointerUp}
        onClick={(event) => { event.stopPropagation(); if (tuneMode) setSelectedKey(showPawcream ? 'pawcream' : 'window') }}
        style={{
          position: 'absolute', left: `${pairLayout.x}%`, top: `${pairLayout.y}%`, width: `${pairLayout.width}%`,
          transform: `translate(-50%, -50%) rotate(${pairLayout.rotation}deg)`, transformOrigin: '50% 50%',
          zIndex: ASSETS.window.zIndex, cursor: tuneMode ? 'grab' : mobile ? 'default' : 'pointer',
          touchAction: tuneMode ? 'none' : 'auto', userSelect: 'none',
          outline: pairSelectedOutline ? '1.5px dashed rgba(213,111,157,.9)' : 'none', outlineOffset: pairSelectedOutline ? 6 : 0,
        }}
      >
        <img key={showPawcream ? 'pawcream' : 'window'} src={showPawcream ? ASSETS.pawcream.src : ASSETS.window.src} alt={showPawcream ? ASSETS.pawcream.label : ASSETS.window.label} draggable={false} decoding="async" style={{ display: 'block', width: '100%', height: 'auto', pointerEvents: 'none', userSelect: 'none' }} />
      </div>

      {STANDARD_ASSET_ORDER.map(renderAsset)}

      {!tuneMode && (
        <nav aria-label="PawCream Atelier toolbar" style={{
          position: 'absolute', left: '50%', top: mobile ? 10 : 16, zIndex: 55,
          width: mobile ? 'calc(100% - 24px)' : 'min(720px, calc(100% - 40px))', minHeight: mobile ? 48 : 54,
          transform: topBarOpen ? 'translate(-50%, 0)' : 'translate(-50%, calc(-100% - 24px))',
          opacity: topBarOpen ? 1 : 0, pointerEvents: topBarOpen ? 'auto' : 'none', transition: 'transform 320ms ease, opacity 240ms ease',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: mobile ? '7px 8px 7px 12px' : '8px 10px 8px 16px', border: '1px solid rgba(205,148,168,.2)',
          borderRadius: mobile ? 18 : 999, background: 'rgba(255,252,253,.9)', boxShadow: '0 14px 40px rgba(100,76,85,.12)',
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', color: '#80636d', fontFamily: uiFont,
        }}>
          <strong style={{ fontSize: mobile ? 11 : 12, whiteSpace: 'nowrap' }}>PawCream</strong>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: mobile ? 'wrap' : 'nowrap', gap: 6 }}>
            <div style={{ display: 'flex', padding: 2, borderRadius: 999, background: 'rgba(243,231,235,.7)' }}>
              {(['zh', 'en'] as Language[]).map((item) => (
                <button key={item} type="button" onClick={() => setLanguage(item)} style={{ border: 0, borderRadius: 999, padding: mobile ? '5px 7px' : '6px 9px', background: language === item ? 'rgba(255,255,255,.94)' : 'transparent', color: '#8d6d78', fontSize: mobile ? 9 : 10, cursor: 'pointer' }}>{item === 'zh' ? '中文' : 'EN'}</button>
              ))}
            </div>
            <button type="button" onClick={() => setHintMode((v) => !v)} style={{ ...smallButtonStyle, minHeight: mobile ? 28 : 32, padding: '0 10px', background: hintMode ? '#f8e8ee' : 'rgba(255,255,255,.76)' }}>{copy.toolbarHint} {hintMode ? '✓' : ''}</button>
            <button type="button" onClick={onBack} style={{ ...smallButtonStyle, minHeight: mobile ? 28 : 32, padding: '0 10px' }}>{copy.toolbarHome}</button>
            <button type="button" onClick={() => setLoginNoticeOpen((v) => !v)} style={{ ...smallButtonStyle, minHeight: mobile ? 28 : 32, padding: '0 10px' }}>{copy.toolbarLogin}</button>
            <button type="button" onClick={closeToolbar} aria-label={copy.toolbarClose} title={copy.toolbarClose} style={{ width: mobile ? 28 : 32, height: mobile ? 28 : 32, border: '1px solid rgba(198,133,157,.2)', borderRadius: '50%', background: 'rgba(255,255,255,.78)', color: '#9b7682', cursor: 'pointer' }}>×</button>
          </div>
        </nav>
      )}

      {!tuneMode && loginNoticeOpen && topBarOpen && (
        <div role="dialog" aria-label={copy.loginTitle} style={{ position: 'absolute', right: mobile ? 12 : 22, top: mobile ? 76 : 84, zIndex: 56, width: mobile ? 'min(300px, calc(100% - 24px))' : 320, padding: 16, border: '1px solid rgba(205,148,168,.2)', borderRadius: 18, background: 'rgba(255,252,253,.95)', boxShadow: '0 16px 42px rgba(100,76,85,.14)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', color: '#80636d', fontFamily: uiFont }}>
          <strong style={{ display: 'block', marginBottom: 7, fontSize: 13 }}>{copy.loginTitle}</strong>
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6 }}>{copy.loginBody}</p>
          <button type="button" onClick={() => setLoginNoticeOpen(false)} style={{ ...smallButtonStyle, marginTop: 12, padding: '0 12px' }}>{copy.close}</button>
        </div>
      )}

      {!tuneMode && boardOpen && (
        <div role="dialog" aria-modal="true" aria-label={copy.boardTitle} onClick={(event) => event.stopPropagation()} style={{ position: 'absolute', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', padding: mobile ? 14 : 28, background: 'rgba(255,249,251,.62)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', fontFamily: uiFont }}>
          <section style={{ width: mobile ? '100%' : 'min(620px, 100%)', maxHeight: mobile ? 'calc(100% - 20px)' : 'min(720px, calc(100% - 32px))', overflow: 'auto', padding: mobile ? 18 : 24, border: '1px solid rgba(205,148,168,.22)', borderRadius: mobile ? 22 : 28, background: 'rgba(255,253,253,.96)', boxShadow: '0 24px 70px rgba(101,74,84,.16)', color: '#765d66' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <strong style={{ display: 'block', fontSize: mobile ? 17 : 20 }}>{copy.boardTitle}</strong>
                <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.55, color: '#9d818a' }}>{copy.boardSubtitle}</p>
              </div>
              <button type="button" onClick={() => setBoardOpen(false)} aria-label={copy.close} style={{ width: 34, height: 34, flex: '0 0 auto', border: '1px solid rgba(198,133,157,.2)', borderRadius: '50%', background: '#fff', color: '#98737f', cursor: 'pointer' }}>×</button>
            </header>
            <textarea value={boardDraft} maxLength={280} onChange={(event) => setBoardDraft(event.currentTarget.value)} placeholder={copy.boardPlaceholder} style={{ width: '100%', minHeight: mobile ? 110 : 130, marginTop: 18, resize: 'vertical', border: '1px solid rgba(205,148,168,.24)', borderRadius: 18, padding: '13px 14px', outline: 'none', background: 'rgba(255,249,251,.78)', color: '#715a63', font: `13px/1.65 ${uiFont}`, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 9 }}>
              <span style={{ fontSize: 9, color: '#b0969f' }}>{copy.boardLocal}</span>
              <button type="button" disabled={!boardDraft.trim()} onClick={submitBoardMessage} style={{ minHeight: 34, border: '1px solid rgba(203,130,158,.28)', borderRadius: 999, padding: '0 15px', background: boardDraft.trim() ? '#f7e6ed' : '#f5f1f2', color: boardDraft.trim() ? '#8f6072' : '#b7a7ad', cursor: boardDraft.trim() ? 'pointer' : 'default', fontSize: 11 }}>{copy.boardSubmit}</button>
            </div>
            <div style={{ display: 'grid', gap: 9, marginTop: 20 }}>
              {boardMessages.length === 0 ? (
                <p style={{ margin: 0, padding: '18px 12px', borderRadius: 16, background: 'rgba(249,241,244,.62)', color: '#ad919b', fontSize: 11, textAlign: 'center' }}>{copy.boardEmpty}</p>
              ) : boardMessages.map((item) => (
                <article key={item.id} style={{ padding: '12px 14px', border: '1px solid rgba(209,156,176,.16)', borderRadius: 16, background: 'rgba(253,247,249,.78)' }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#765d66', fontSize: 12, lineHeight: 1.65 }}>{item.text}</p>
                  <time dateTime={new Date(item.createdAt).toISOString()} style={{ display: 'block', marginTop: 7, color: '#b097a0', fontSize: 9 }}>{new Date(item.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  )

  return (
    <main style={{ minHeight: mobilePreview ? 940 : '100svh', display: mobilePreview ? 'block' : 'grid', placeItems: mobilePreview ? undefined : 'center', overflowX: 'hidden', overflowY: mobilePreview ? 'auto' : 'hidden', background: mobilePreview ? '#fbf9fa' : '#ffffff', position: 'relative', isolation: 'isolate' }}>
      {tuneMode && (
        <button type="button" onClick={onBack} aria-label="Back to PawCream home" style={{ position: 'fixed', left: 18, top: 18, zIndex: 75, border: '1px solid rgba(164,132,143,.2)', borderRadius: 999, background: 'rgba(255,255,255,.82)', color: '#8e757d', padding: '8px 13px', cursor: 'pointer', boxShadow: '0 8px 28px rgba(100,79,86,.07)', backdropFilter: 'blur(12px)' }}>← Home</button>
      )}

      {mobilePreview ? (
        <div style={{ width: 'calc(100% - 390px)', minWidth: 470, minHeight: 940, display: 'grid', placeItems: 'center', padding: '32px 24px' }}>
          <div className="mobile-device-shell">
            <div className="mobile-reference-label" aria-hidden="true">Atelier phone preview · 390 × 844 CSS px</div>
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
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '13px 14px 12px 16px', borderBottom: collapsed ? 0 : '1px solid rgba(198,133,157,.15)' }}>
            <div>
              <strong style={{ display: 'block', fontSize: 13 }}>Atelier Tune · Light OFF</strong>
              <span style={{ fontSize: 10, color: '#aa8c96' }}>12 个素材统一调试 · Position / Size / Rotation</span>
            </div>
            <button type="button" onClick={() => setCollapsed((v) => !v)} style={{ width: 30, height: 30, border: '1px solid rgba(198,133,157,.24)', borderRadius: '50%', background: 'rgba(255,255,255,.75)', color: '#9d7180', cursor: 'pointer' }}>{collapsed ? '+' : '−'}</button>
          </header>

          {!collapsed && (
            <div style={{ maxHeight: 'calc(100svh - 92px)', overflowY: 'auto', padding: '14px 16px 16px' }}>
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: '#947a83' }}>
                调试模式固定为关灯状态。Window / PawCream 位置、大小与旋转联动；Color 与 Music 等素材使用同一套参数面板。
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 13 }}>
                {(['desktop', 'mobile'] as DeviceProfile[]).map((profile) => (
                  <button key={profile} type="button" onClick={() => onDeviceChange(profile)} style={{ ...smallButtonStyle, minHeight: 38, fontWeight: 650, background: deviceProfile === profile ? 'rgba(248,232,238,.98)' : 'rgba(255,255,255,.78)', borderColor: deviceProfile === profile ? 'rgba(213,111,157,.55)' : 'rgba(198,133,157,.24)' }}>
                    {profile === 'desktop' ? '电脑端 · 全屏' : '手机端 · 390×844'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 13, paddingTop: 12, borderTop: '1px solid rgba(198,133,157,.13)' }}>
                {ASSET_ORDER.map((key) => (
                  <button key={key} type="button" onClick={() => setSelectedKey(key)} style={{ ...smallButtonStyle, background: selectedKey === key ? 'rgba(248,232,238,.98)' : 'rgba(255,255,255,.78)', borderColor: selectedKey === key ? 'rgba(213,111,157,.5)' : 'rgba(198,133,157,.24)' }}>
                    {ASSETS[key].label}
                  </button>
                ))}
              </div>

              <section style={{ marginTop: 15, paddingTop: 12, borderTop: '1px solid rgba(198,133,157,.13)' }}>
                <strong style={{ display: 'block', marginBottom: 7, fontSize: 11 }}>
                  {deviceProfile === 'desktop' ? '电脑端' : '手机端'} · {ASSETS[selectedKey].label}
                </strong>
                <RangeRow label="X" value={selected.x} min={0} max={100} step={0.5} suffix="%" onChange={(v) => updateSelected('x', v)} />
                <RangeRow label="Y" value={selected.y} min={0} max={100} step={0.5} suffix="%" onChange={(v) => updateSelected('y', v)} />
                <RangeRow label="Size" value={selected.width} min={5} max={selectedKey === 'color' ? 120 : 95} step={0.5} suffix="%" onChange={(v) => updateSelected('width', v)} />
                <RangeRow label="Rotate" value={selected.rotation} min={-180} max={180} step={1} suffix="°" onChange={(v) => updateSelected('rotation', v)} />
              </section>

              {selectedKey === 'color' && (
                <section style={{ marginTop: 13, paddingTop: 12, borderTop: '1px solid rgba(198,133,157,.13)' }}>
                  <strong style={{ display: 'block', marginBottom: 7, fontSize: 11 }}>Color · 背景预览</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {BACKGROUND_URLS.map((_, index) => (
                      <button key={index} type="button" onClick={() => setBackgroundIndex(index)} style={{ ...smallButtonStyle, background: backgroundIndex === index ? '#f8e8ee' : 'rgba(255,255,255,.78)', borderColor: backgroundIndex === index ? 'rgba(213,111,157,.5)' : 'rgba(198,133,157,.24)' }}>BG {index + 1}</button>
                    ))}
                  </div>
                </section>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
                <button type="button" style={{ ...smallButtonStyle, background: '#f8e8ee' }} onClick={copySettings}>{copyStatus}</button>
                <button type="button" style={smallButtonStyle} onClick={resetCurrentProfile}>恢复当前端</button>
              </div>

              <p style={{ margin: '10px 0 0', fontSize: 10, lineHeight: 1.5, color: '#aa8c96' }}>
                Note 正式页采用像素透明度命中：只有点到 Note 实际有图案的像素才会打开留言板，透明底不再触发。
              </p>
            </div>
          )}
        </aside>
      )}
    </main>
  )
}
