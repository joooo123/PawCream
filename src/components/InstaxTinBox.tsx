import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { PawCreamStoredPhoto } from '../pawcreamPhotoStore'
import {
  getCurrentUser,
  getMyPublishedPhoto,
  isPawCreamApiEnabled,
  openPawCreamSignin,
  publishPhoto,
  revokePublishedPhoto,
  type PawCreamPublicPhoto,
} from '../pawcreamApi'

type Props = {
  photos: PawCreamStoredPhoto[]
  newestPhotoId: string | null
  mobile: boolean
  textColor: string
  panelBg: string
  panelBorder: string
  accent: string
  onMakeAnother: () => void
  onClose: () => void
}

type PhotoView = PawCreamStoredPhoto & {
  url: string
}

const boxAssetUrl = () => `${import.meta.env.BASE_URL}assets/iron_box.png`
const nameTagAssetUrl = () => `${import.meta.env.BASE_URL}assets/${encodeURIComponent('姓名贴.png')}`

function clampIndex(index: number, length: number) {
  if (!length) return 0
  return Math.min(length - 1, Math.max(0, index))
}

type StoreLayoutKey = 'square' | 'double' | 'wide' | 'portrait-1' | 'portrait-2' | 'four'

type StorePreset = {
  rotation: 0 | 90
  width: string
  height: string
  scale: number
}

type StoreTune = Record<StoreLayoutKey, number>
type StorePositionTune = Record<StoreLayoutKey, number>

const STORE_TUNE_KEY = 'pawcream-instax-box-size-tune-v2'
const STORE_POSITION_TUNE_KEY = 'pawcream-instax-box-position-tune-v2'

const STORE_LAYOUTS: Array<{ key: StoreLayoutKey; label: string }> = [
  { key: 'square', label: '方形' },
  { key: 'double', label: '两格' },
  { key: 'wide', label: '横向' },
  { key: 'portrait-1', label: '竖向 1' },
  { key: 'portrait-2', label: '竖向 2' },
  { key: 'four', label: '四格' },
]

const DEFAULT_STORE_TUNE: StoreTune = {
  square: 1.15,
  double: 1.07,
  wide: 1.29,
  'portrait-1': 1.34,
  'portrait-2': 1.45,
  four: 1.89,
}

const DEFAULT_STORE_POSITION_TUNE: StorePositionTune = {
  square: -30,
  double: -30,
  wide: -30,
  'portrait-1': -30,
  'portrait-2': -30,
  four: -30,
}

function storeLayoutKey(frameName: string): StoreLayoutKey {
  if (frameName.includes('横')) return 'wide'
  if (frameName.includes('两格') || frameName.includes('两张')) return 'double'
  if (frameName.includes('四格')) return 'four'
  if (frameName.includes('竖2')) return 'portrait-2'
  if (frameName.includes('竖1')) return 'portrait-1'
  return 'square'
}

function storePreset(frameName: string): StorePreset {
  const layout = storeLayoutKey(frameName)
  if (layout === 'wide') return { rotation: 0, width: '86%', height: '82%', scale: 1.02 }
  if (layout === 'double') return { rotation: 0, width: '88%', height: '84%', scale: 1.02 }
  if (layout === 'four') return { rotation: 90, width: '74%', height: '94%', scale: 1.06 }
  if (layout === 'portrait-2') return { rotation: 90, width: '72%', height: '94%', scale: 1.08 }
  if (layout === 'portrait-1') return { rotation: 90, width: '76%', height: '92%', scale: 1.08 }
  return { rotation: 90, width: '80%', height: '90%', scale: 1.08 }
}

function stableJitter(id: string) {
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const unit = (shift: number) => ((hash >>> shift) & 255) / 255
  return {
    x: (unit(0) - .5) * 5.2,
    y: (unit(8) - .5) * 3.2,
    angle: (unit(16) - .5) * 4.4,
  }
}

function readStoreTune(): StoreTune {
  if (typeof window === 'undefined') return { ...DEFAULT_STORE_TUNE }
  try {
    const raw = window.localStorage.getItem(STORE_TUNE_KEY)
    if (!raw) return { ...DEFAULT_STORE_TUNE }
    const parsed = JSON.parse(raw) as Partial<StoreTune>
    return {
      square: Number(parsed.square) || 1,
      double: Number(parsed.double) || 1,
      wide: Number(parsed.wide) || 1,
      'portrait-1': Number(parsed['portrait-1']) || 1,
      'portrait-2': Number(parsed['portrait-2']) || 1,
      four: Number(parsed.four) || 1,
    }
  } catch {
    return { ...DEFAULT_STORE_TUNE }
  }
}


function readStorePositionTune(): StorePositionTune {
  if (typeof window === 'undefined') return { ...DEFAULT_STORE_POSITION_TUNE }
  try {
    const raw = window.localStorage.getItem(STORE_POSITION_TUNE_KEY)
    if (!raw) return { ...DEFAULT_STORE_POSITION_TUNE }
    const parsed = JSON.parse(raw) as Partial<StorePositionTune>
    const readValue = (key: StoreLayoutKey) => {
      const value = Number(parsed[key])
      return Number.isFinite(value) ? value : DEFAULT_STORE_POSITION_TUNE[key]
    }
    return {
      square: readValue('square'),
      double: readValue('double'),
      wide: readValue('wide'),
      'portrait-1': readValue('portrait-1'),
      'portrait-2': readValue('portrait-2'),
      four: readValue('four'),
    }
  } catch {
    return { ...DEFAULT_STORE_POSITION_TUNE }
  }
}

export default function InstaxTinBox({
  photos,
  newestPhotoId,
  mobile,
  textColor,
  panelBg,
  panelBorder,
  accent,
  onMakeAnother,
  onClose,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dropDone, setDropDone] = useState(false)
  const [storeTune, setStoreTune] = useState<StoreTune>(() => readStoreTune())
  const [storePositionTune, setStorePositionTune] = useState<StorePositionTune>(() => readStorePositionTune())
  const [copyStatus, setCopyStatus] = useState('复制参数')
  const [publishedPhoto, setPublishedPhoto] = useState<PawCreamPublicPhoto | null>(null)
  const [publishBusy, setPublishBusy] = useState(false)
  const [publishStatus, setPublishStatus] = useState('')
  const pointerStart = useRef<number | null>(null)
  const boxTuneMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('boxTune') === '1',
    [],
  )

  const views = useMemo<PhotoView[]>(
    () => photos.map((photo) => ({
      ...photo,
      url: URL.createObjectURL(photo.imageBlob),
    })),
    [photos],
  )

  useEffect(() => () => {
    views.forEach((photo) => URL.revokeObjectURL(photo.url))
  }, [views])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORE_TUNE_KEY, JSON.stringify(storeTune))
  }, [storeTune])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORE_POSITION_TUNE_KEY, JSON.stringify(storePositionTune))
  }, [storePositionTune])

  useEffect(() => {
    const newestIndex = newestPhotoId
      ? views.findIndex((photo) => photo.id === newestPhotoId)
      : 0
    setActiveIndex(newestIndex >= 0 ? newestIndex : 0)
    setDropDone(false)
    const timer = window.setTimeout(() => setDropDone(true), 1050)
    return () => window.clearTimeout(timer)
  }, [newestPhotoId, views])

  const active = views[activeIndex] ?? null
  useEffect(() => {
    if (!expanded || !active || !isPawCreamApiEnabled()) return
    let cancelled = false
    setPublishedPhoto(null)
    void getMyPublishedPhoto(active.id)
      .then((photo) => { if (!cancelled) setPublishedPhoto(photo) })
      .catch(() => { if (!cancelled) setPublishedPhoto(null) })
    return () => { cancelled = true }
  }, [expanded, active?.id])

  const togglePublished = async () => {
    if (!active || publishBusy) return
    if (!isPawCreamApiEnabled()) {
      setPublishStatus('当前预览站未连接照片共享后端，请使用正式站点公开返图')
      return
    }

    setPublishBusy(true)
    setPublishStatus('')
    try {
      const user = await getCurrentUser()
      if (!user) {
        setPublishStatus('请先登录 PawCream 后再公开返图')
        openPawCreamSignin('login')
        return
      }
      if (publishedPhoto) {
        if (!window.confirm('要从公共返图墙撤回这张照片吗？铁盒里的原图会保留。')) return
        await revokePublishedPhoto(publishedPhoto.id)
        setPublishedPhoto(null)
        setPublishStatus('已撤回公开，铁盒里的照片仍保留 ♡')
      } else {
        if (!window.confirm('确认公开这张拍立得？公开后其他访客都能看到图片和你的用户名。')) return
        const published = await publishPhoto({
          id: active.id, frameName: active.frameName, imageBlob: active.imageBlob,
        })
        setPublishedPhoto(published)
        setPublishStatus('已公开到公共返图墙 ♡')
      }
    } catch (error) {
      setPublishStatus(error instanceof Error ? error.message : '公开状态更新失败')
    } finally {
      setPublishBusy(false)
    }
  }

  const stacked = views.slice(0, 4).reverse()
  const ownerName = views[0]?.ownerName || 'Creamy'
  const ownerFontSize = ownerName.length > 12
    ? (mobile ? 11 : 13)
    : ownerName.length > 8
      ? (mobile ? 12 : 14)
      : (mobile ? 14 : 16)

  const themedButton: CSSProperties = {
    minHeight: 40,
    border: `1px solid ${panelBorder}`,
    borderRadius: 999,
    padding: '8px 18px',
    background: 'rgba(255,255,255,.82)',
    color: textColor,
    boxShadow: '0 6px 18px rgba(86,71,77,.08)',
    cursor: 'pointer',
    fontSize: mobile ? 16 : 18,
  }

  const move = (direction: number) => {
    setActiveIndex((current) => clampIndex(current + direction, views.length))
  }

  const updateStoreTune = (key: StoreLayoutKey, value: number) => {
    setStoreTune((current) => ({ ...current, [key]: value }))
  }

  const updateStorePositionTune = (key: StoreLayoutKey, value: number) => {
    setStorePositionTune((current) => ({ ...current, [key]: value }))
  }

  const resetStoreTune = () => {
    setStoreTune({ ...DEFAULT_STORE_TUNE })
    setStorePositionTune({ ...DEFAULT_STORE_POSITION_TUNE })
    setCopyStatus('已重置')
    window.setTimeout(() => setCopyStatus('复制参数'), 900)
  }

  const copyStoreTune = async () => {
    const payload = JSON.stringify({
      size: storeTune,
      positionY: storePositionTune,
    }, null, 2)
    try {
      await navigator.clipboard.writeText(payload)
      setCopyStatus('已复制 ✓')
    } catch {
      setCopyStatus(payload)
    }
    window.setTimeout(() => setCopyStatus('复制参数'), 1400)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStart.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (start === null) return
    const delta = event.clientX - start
    if (Math.abs(delta) < 35) return
    move(delta < 0 ? 1 : -1)
  }

  if (expanded) {
    return (
      <div style={{ width: '100%', minHeight: mobile ? 500 : 560 }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: mobile ? 25 : 29, fontWeight: 750, color: textColor }}>
            my little box
          </div>
          <div style={{ marginTop: 4, fontSize: mobile ? 14 : 16, color: textColor, opacity: .68 }}>
            左右滑一滑，翻翻收好的每一张 ♡
          </div>
        </div>

        {views.length ? (
          <>
            <div
              role="region"
              aria-label="My Instax cover flow"
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={() => { pointerStart.current = null }}
              style={{
                position: 'relative',
                height: mobile ? 360 : 420,
                width: '100%',
                overflow: 'hidden',
                perspective: '1200px',
                perspectiveOrigin: '50% 46%',
                touchAction: 'pan-y',
                userSelect: 'none',
              }}
            >
              {views.map((photo, index) => {
                const offset = index - activeIndex
                const distance = Math.abs(offset)
                const visible = distance <= 3
                const x = offset * (mobile ? 102 : 142)
                const rotateY = offset === 0 ? 0 : offset > 0 ? -46 : 46
                const z = distance === 0 ? 80 : -80 - distance * 55
                const scale = distance === 0 ? 1 : Math.max(.64, .86 - distance * .08)
                const opacity = visible ? Math.max(.22, 1 - distance * .22) : 0

                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`第 ${index + 1} 张拍立得`}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: mobile ? 190 : 230,
                      height: mobile ? 285 : 340,
                      marginLeft: mobile ? -95 : -115,
                      marginTop: mobile ? -142 : -170,
                      padding: 0,
                      border: 0,
                      background: 'transparent',
                      cursor: 'pointer',
                      opacity,
                      pointerEvents: visible ? 'auto' : 'none',
                      transform: `translate3d(${x}px,0,${z}px) rotateY(${rotateY}deg) scale(${scale})`,
                      transformStyle: 'preserve-3d',
                      transformOrigin: '50% 50%',
                      transition: 'transform 560ms cubic-bezier(.16,1,.3,1), opacity 360ms ease, filter 360ms ease',
                      zIndex: 20 - distance,
                      filter: distance === 0
                        ? 'drop-shadow(0 20px 28px rgba(71,60,65,.22))'
                        : 'drop-shadow(0 10px 16px rgba(71,60,65,.10))',
                    }}
                  >
                    <img
                      src={photo.url}
                      alt=""
                      draggable={false}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  </button>
                )
              })}
            </div>

            <div
              style={{
                width: 'min(500px,100%)',
                margin: '-4px auto 0',
                padding: '12px 14px',
                borderRadius: 18,
                border: `1px solid ${panelBorder}`,
                background: panelBg,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: mobile ? 14 : 16, color: textColor, opacity: .72 }}>
                {activeIndex + 1} / {views.length}
                {active ? ` · ${new Date(active.createdAt).toLocaleDateString('zh-CN')}` : ''}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={activeIndex <= 0}
                  onClick={() => move(-1)}
                  style={{ ...themedButton, opacity: activeIndex <= 0 ? .35 : 1 }}
                >
                  ←
                </button>
                <button type="button" onClick={() => setExpanded(false)} style={themedButton}>
                  收回盒子里
                </button>
                <button type="button" onClick={() => void togglePublished()} disabled={publishBusy} style={{
                  ...themedButton,
                  opacity: publishBusy ? .55 : 1,
                  borderColor: publishedPhoto ? '#e0a9b5' : panelBorder,
                }}>
                  {publishBusy ? '请稍候…' : publishedPhoto ? '撤回公开' : '公开到返图墙'}
                </button>
                <button
                  type="button"
                  disabled={activeIndex >= views.length - 1}
                  onClick={() => move(1)}
                  style={{ ...themedButton, opacity: activeIndex >= views.length - 1 ? .35 : 1 }}
                >
                  →
                </button>
              </div>
              {publishStatus && (
                <div role="status" style={{ color: textColor, textAlign: 'center', fontSize: 13, marginTop: 10 }}>
                  {publishStatus}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: textColor }}>
            盒子还是空空的，先做一张拍立得吧 ♡
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      <style>{`
        @keyframes pawcream-box-arrive {
          0% { opacity: 0; transform: translateY(24px) scale(.94); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pawcream-photo-stack-drop {
          0% {
            opacity: .18;
            transform: translate(-50%,-118%);
          }
          34% { opacity: 1; }
          82% {
            transform: translate(-50%,3%);
          }
          92% {
            transform: translate(-50%,-2%);
          }
          100% {
            opacity: 1;
            transform: translate(-50%,0%);
          }
        }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: mobile ? 25 : 29, fontWeight: 750, color: textColor }}>
          my little box
        </div>
        <div style={{ marginTop: 4, fontSize: mobile ? 14 : 16, color: textColor, opacity: .7 }}>
          {dropDone ? '收好啦 ♡' : '轻轻放进去…'}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          width: mobile ? 'min(350px,88vw)' : 'min(470px,66vw)',
          aspectRatio: '1080 / 1386',
          margin: '0 auto',
          animation: 'pawcream-box-arrive 460ms cubic-bezier(.16,1,.3,1) both',
        }}
      >
        <img
          src={boxAssetUrl()}
          alt="Open PawCream tin box"
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            zIndex: 4,
            pointerEvents: 'none',
            userSelect: 'none',
            filter: 'drop-shadow(0 16px 26px rgba(69,65,64,.14))',
          }}
        />

        <div
          aria-label={`${ownerName} 的姓名贴`}
          style={{
            position: 'absolute',
            left: '23%',
            top: '14.8%',
            width: '54%',
            height: '23.5%',
            zIndex: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            clipPath: 'ellipse(50% 50% at 50% 50%)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={nameTagAssetUrl()}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transform: 'translateY(10px) scale(3.24)',
                userSelect: 'none',
              }}
            />
            <span
              style={{
                position: 'relative',
                zIndex: 1,
                maxWidth: '72%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: '#7d655f',
                fontSize: ownerFontSize * 1.75,
                fontWeight: 650,
                letterSpacing: '.04em',
                lineHeight: 1,
                textAlign: 'center',
                textShadow: '0 1px 0 rgba(255,255,255,.75)',
              }}
            >
              {ownerName}
            </span>
          </div>
        </div>

        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '4.6%',
            top: '52.2%',
            width: '90.8%',
            height: '43.5%',
            overflow: 'hidden',
            clipPath: 'polygon(0 0, 100% 0, 100% calc(89% - 13px), 99% calc(92% - 13px), 97% calc(95% - 13px), 94% calc(97.5% - 13px), 90% calc(99% - 13px), 83% calc(100% - 13px), 17% calc(100% - 13px), 10% calc(99% - 13px), 6% calc(97.5% - 13px), 3% calc(95% - 13px), 1% calc(92% - 13px), 0 calc(89% - 13px))',
            zIndex: 7,
            pointerEvents: 'none',
          }}
        >
          {stacked.map((photo, index) => {
            const isNewest = photo.id === newestPhotoId
            const layout = storeLayoutKey(photo.frameName)
            const preset = storePreset(photo.frameName)
            const jitter = boxTuneMode ? { x: 0, y: 0, angle: 0 } : stableJitter(photo.id)
            const stackLift = boxTuneMode ? 0 : index * 1.2
            const finalScale = preset.scale * storeTune[layout]
            const tunedY = storePositionTune[layout]

            return (
              <div
                key={photo.id}
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${jitter.x}%)`,
                  top: `calc(50% + ${tunedY + jitter.y + stackLift}%)`,
                  width: '100%',
                  height: '100%',
                  transform: 'translate(-50%,0)',
                  animation: isNewest
                    ? 'pawcream-photo-stack-drop 980ms cubic-bezier(.16,1,.3,1) 120ms both'
                    : undefined,
                  zIndex: 8 + index,
                  pointerEvents: 'none',
                }}
              >
                <img
                  src={photo.url}
                  alt=""
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: preset.width,
                    height: preset.height,
                    objectFit: 'contain',
                    transform: `translate(-50%,-50%) rotate(${preset.rotation + jitter.angle}deg) scale(${finalScale})`,
                    transformOrigin: '50% 50%',
                    filter: 'drop-shadow(0 5px 8px rgba(55,49,49,.16))',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {boxTuneMode && (
        <div
          style={{
            width: 'min(560px,100%)',
            margin: '-4px auto 12px',
            padding: '14px 16px',
            borderRadius: 18,
            border: `1px dashed ${panelBorder}`,
            background: 'rgba(255,255,255,.72)',
            color: textColor,
          }}
        >
          <div style={{ textAlign: 'center', fontSize: mobile ? 16 : 18, fontWeight: 750 }}>
            小盒子尺寸调试
          </div>
          <div style={{ marginTop: 4, textAlign: 'center', fontSize: mobile ? 12 : 14, opacity: .68 }}>
            调试模式关闭随机偏移和微旋转，可以分别调整每种相纸的大小和上下位置
          </div>

          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {STORE_LAYOUTS.map((layout) => (
              <div
                key={layout.key}
                style={{
                  display: 'grid',
                  gap: 6,
                  paddingBottom: 8,
                  borderBottom: `1px solid ${panelBorder}`,
                }}
              >
                <div style={{ fontSize: mobile ? 13 : 15, fontWeight: 700 }}>
                  {layout.label}
                </div>

                <label
                  style={{
                    display: 'grid',
                    gridTemplateColumns: mobile ? '44px 1fr 52px' : '54px 1fr 62px',
                    alignItems: 'center',
                    gap: 9,
                    fontSize: mobile ? 12 : 14,
                  }}
                >
                  <span>大小</span>
                  <input
                    type="range"
                    min=".65"
                    max="2"
                    step=".01"
                    value={storeTune[layout.key]}
                    onChange={(event) => updateStoreTune(layout.key, Number(event.currentTarget.value))}
                    style={{ width: '100%', accentColor: accent }}
                  />
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(storeTune[layout.key] * 100)}%
                  </span>
                </label>

                <label
                  style={{
                    display: 'grid',
                    gridTemplateColumns: mobile ? '44px 1fr 52px' : '54px 1fr 62px',
                    alignItems: 'center',
                    gap: 9,
                    fontSize: mobile ? 12 : 14,
                  }}
                >
                  <span>上下</span>
                  <input
                    type="range"
                    min="-30"
                    max="20"
                    step="1"
                    value={storePositionTune[layout.key]}
                    onChange={(event) => updateStorePositionTune(layout.key, Number(event.currentTarget.value))}
                    style={{ width: '100%', accentColor: accent }}
                  />
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {storePositionTune[layout.key] > 0 ? '+' : ''}{storePositionTune[layout.key]}%
                  </span>
                </label>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" onClick={() => void copyStoreTune()} style={themedButton}>
              {copyStatus}
            </button>
            <button type="button" onClick={resetStoreTune} style={themedButton}>
              重置尺寸
            </button>
          </div>
        </div>
      )}

      {dropDone && (
        <div
          style={{
            width: 'min(520px,100%)',
            margin: mobile ? '-4px auto 0' : '-12px auto 0',
            padding: '12px 14px',
            borderRadius: 18,
            border: `1px solid ${panelBorder}`,
            background: panelBg,
          }}
        >
          <div style={{ textAlign: 'center', color: textColor, fontSize: mobile ? 14 : 16, opacity: .72 }}>
            小盒子里已经有 {views.length} 张拍立得
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 9, flexWrap: 'wrap', marginTop: 10 }}>
            <button
              type="button"
              onClick={() => {
                const index = newestPhotoId
                  ? views.findIndex((photo) => photo.id === newestPhotoId)
                  : 0
                setActiveIndex(index >= 0 ? index : 0)
                setExpanded(true)
              }}
              style={{
                ...themedButton,
                background: 'rgba(255,255,255,.92)',
                boxShadow: `0 7px 22px color-mix(in srgb, ${accent} 18%, transparent)`,
              }}
            >
              全展开看看
            </button>
            <button type="button" onClick={onMakeAnother} style={themedButton}>
              再做一张
            </button>
            <button type="button" onClick={onClose} style={themedButton}>
              收好并离开
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
