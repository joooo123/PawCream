import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { PawCreamStoredPhoto } from '../pawcreamPhotoStore'

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

function clampIndex(index: number, length: number) {
  if (!length) return 0
  return Math.min(length - 1, Math.max(0, index))
}

function storeRotation(frameName: string) {
  const keepLandscape = frameName.includes('横')
    || frameName.includes('两格')
    || frameName.includes('两张')
  return keepLandscape ? 0 : 90
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
  const pointerStart = useRef<number | null>(null)

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
    const newestIndex = newestPhotoId
      ? views.findIndex((photo) => photo.id === newestPhotoId)
      : 0
    setActiveIndex(newestIndex >= 0 ? newestIndex : 0)
    setDropDone(false)
    const timer = window.setTimeout(() => setDropDone(true), 1050)
    return () => window.clearTimeout(timer)
  }, [newestPhotoId, views])

  const active = views[activeIndex] ?? null
  const stacked = views.slice(0, 4).reverse()

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
                <button
                  type="button"
                  disabled={activeIndex >= views.length - 1}
                  onClick={() => move(1)}
                  style={{ ...themedButton, opacity: activeIndex >= views.length - 1 ? .35 : 1 }}
                >
                  →
                </button>
              </div>
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
        @keyframes pawcream-photo-into-box-flat {
          0% {
            opacity: .2;
            transform: translate(-50%,-120%) rotate(0deg) scale(.96);
          }
          36% { opacity: 1; }
          84% {
            transform: translate(-50%,2%) rotate(0deg) scale(.92);
          }
          94% {
            transform: translate(-50%,-2%) rotate(0deg) scale(.96);
          }
          100% {
            opacity: 1;
            transform: translate(-50%,0%) rotate(0deg) scale(.94);
          }
        }
        @keyframes pawcream-photo-into-box-rotated {
          0% {
            opacity: .2;
            transform: translate(-50%,-120%) rotate(0deg) scale(.96);
          }
          38% {
            opacity: 1;
            transform: translate(-50%,-76%) rotate(90deg) scale(.94);
          }
          84% {
            transform: translate(-50%,2%) rotate(90deg) scale(.92);
          }
          94% {
            transform: translate(-50%,-2%) rotate(90deg) scale(.96);
          }
          100% {
            opacity: 1;
            transform: translate(-50%,0%) rotate(90deg) scale(.94);
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
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '13.2%',
            top: '56.4%',
            width: '73.6%',
            height: '35.2%',
            overflow: 'hidden',
            borderRadius: '6%',
            zIndex: 7,
            pointerEvents: 'none',
          }}
        >
          {stacked.map((photo, index) => {
            const isNewest = photo.id === newestPhotoId
            const rotation = storeRotation(photo.frameName)
            const x = [-7, 6, -3, 4][index % 4]
            const y = index * 3

            return (
              <img
                key={photo.id}
                src={photo.url}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '18%',
                  width: rotation === 90 ? '58%' : '62%',
                  height: rotation === 90 ? '74%' : '70%',
                  objectFit: 'contain',
                  transformOrigin: '50% 50%',
                  transform: isNewest
                    ? undefined
                    : `translate(-50%,${y}%) translateX(${x}px) rotate(${rotation}deg) scale(.94)`,
                  animation: isNewest
                    ? `${rotation === 90 ? 'pawcream-photo-into-box-rotated' : 'pawcream-photo-into-box-flat'} 980ms cubic-bezier(.16,1,.3,1) 120ms both`
                    : undefined,
                  zIndex: 8 + index,
                  filter: 'drop-shadow(0 5px 8px rgba(55,49,49,.16))',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            )
          })}
        </div>
      </div>

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
