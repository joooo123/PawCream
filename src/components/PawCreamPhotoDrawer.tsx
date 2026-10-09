import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { PawCreamUser } from '../pawcreamApi'
import {
  PHOTO_DRAWER_CHANGED_EVENT,
  deleteDrawerPhoto,
  listDrawerPhotos,
  type PawCreamDrawerPhoto,
} from '../pawcreamPhotoDrawer'

type Props = {
  open: boolean
  onClose: () => void
  user: PawCreamUser
  mobile: boolean
  highlightedPhotoId?: string | null
}

type PhotoView = {
  photo: PawCreamDrawerPhoto
  url: string
}

type FocusState = {
  view: PhotoView
  sourceRect: DOMRect
}

const uiFont = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

function targetRect(source: DOMRect, mobile: boolean) {
  const aspect = source.width > 0 ? source.height / source.width : 1.25
  const maxWidth = Math.min(mobile ? 330 : 460, window.innerWidth - (mobile ? 28 : 72))
  const maxHeight = window.innerHeight - (mobile ? 90 : 120)
  let width = maxWidth
  let height = width * aspect

  if (height > maxHeight) {
    height = maxHeight
    width = height / aspect
  }

  return {
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2,
    width,
    height,
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export default function PawCreamPhotoDrawer({
  open,
  onClose,
  user,
  mobile,
  highlightedPhotoId = null,
}: Props) {
  const [views, setViews] = useState<PhotoView[]>([])
  const [loading, setLoading] = useState(false)
  const [focus, setFocus] = useState<FocusState | null>(null)
  const [deleting, setDeleting] = useState(false)
  const focusRef = useRef<HTMLButtonElement | null>(null)
  const viewUrlsRef = useRef<string[]>([])

  const revokeUrls = () => {
    viewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    viewUrlsRef.current = []
  }

  const reload = async () => {
    setLoading(true)
    try {
      const photos = await listDrawerPhotos(user.id)
      revokeUrls()
      const nextViews = photos.map((photo) => {
        const url = URL.createObjectURL(photo.imageBlob)
        viewUrlsRef.current.push(url)
        return { photo, url }
      })
      setViews(nextViews)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void reload()
    const onChanged = () => void reload()
    window.addEventListener(PHOTO_DRAWER_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(PHOTO_DRAWER_CHANGED_EVENT, onChanged)
  }, [open, user.id])

  useEffect(() => () => revokeUrls(), [])

  useEffect(() => {
    if (!open) setFocus(null)
  }, [open])

  useLayoutEffect(() => {
    if (!focus || !focusRef.current) return
    const element = focusRef.current
    const destination = targetRect(focus.sourceRect, mobile)
    element.style.left = `${destination.left}px`
    element.style.top = `${destination.top}px`
    element.style.width = `${destination.width}px`
    element.style.height = `${destination.height}px`

    const animation = element.animate(
      [
        {
          left: `${focus.sourceRect.left}px`,
          top: `${focus.sourceRect.top}px`,
          width: `${focus.sourceRect.width}px`,
          height: `${focus.sourceRect.height}px`,
          transform: 'rotate(3deg)',
          boxShadow: '0 8px 18px rgba(82,63,69,.08)',
        },
        {
          left: `${destination.left}px`,
          top: `${destination.top}px`,
          width: `${destination.width}px`,
          height: `${destination.height}px`,
          transform: 'rotate(0deg)',
          boxShadow: '0 28px 80px rgba(82,63,69,.22)',
        },
      ],
      {
        duration: 620,
        easing: 'cubic-bezier(.16,1,.3,1)',
        fill: 'both',
      },
    )

    return () => animation.cancel()
  }, [focus, mobile])

  if (!open) return null

  const openPhoto = (view: PhotoView, event: ReactMouseEvent<HTMLButtonElement>) => {
    setFocus({
      view,
      sourceRect: event.currentTarget.getBoundingClientRect(),
    })
  }

  const closePhoto = async () => {
    if (!focus || !focusRef.current) {
      setFocus(null)
      return
    }

    const element = focusRef.current
    const current = element.getBoundingClientRect()
    const destination = focus.sourceRect
    const animation = element.animate(
      [
        {
          left: `${current.left}px`,
          top: `${current.top}px`,
          width: `${current.width}px`,
          height: `${current.height}px`,
          transform: 'rotate(0deg)',
          opacity: 1,
        },
        {
          left: `${destination.left}px`,
          top: `${destination.top}px`,
          width: `${destination.width}px`,
          height: `${destination.height}px`,
          transform: 'rotate(3deg)',
          opacity: .7,
        },
      ],
      {
        duration: 440,
        easing: 'cubic-bezier(.22,.72,.22,1)',
        fill: 'forwards',
      },
    )

    try {
      await animation.finished
    } catch {
      // Ignore cancelled animations.
    }
    setFocus(null)
  }

  const removeFocused = async () => {
    if (!focus || deleting) return
    setDeleting(true)
    try {
      await deleteDrawerPhoto(focus.view.photo.id, user.id)
      setFocus(null)
      await reload()
    } finally {
      setDeleting(false)
    }
  }

  const drawerStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 155,
    display: 'grid',
    placeItems: 'center',
    padding: mobile ? 10 : 24,
    background: 'rgba(255,250,251,.58)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    fontFamily: uiFont,
    color: '#80636d',
  }

  return (
    <div style={drawerStyle} role="presentation">
      <style>{`
        @keyframes pawcream-drawer-open {
          from { opacity: 0; transform: translateY(18px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pawcream-drawer-new-photo {
          0%, 100% { box-shadow: 0 8px 20px rgba(101,79,86,.10); }
          50% { box-shadow: 0 10px 30px rgba(218,151,177,.42); }
        }
        .pawcream-drawer-photo {
          transition: transform 260ms cubic-bezier(.2,.72,.22,1), filter 260ms ease;
        }
        @media (hover: hover) and (pointer: fine) {
          .pawcream-drawer-photo:hover {
            transform: perspective(900px) rotateX(0deg) translateY(-8px) scale(1.025) !important;
            filter: brightness(1.02);
          }
        }
      `}</style>

      <section
        role="dialog"
        aria-modal="true"
        aria-label="我的照片抽屉"
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'relative',
          width: mobile ? 'min(390px, calc(100vw - 20px))' : 'min(760px, calc(100vw - 48px))',
          height: mobile ? 'min(720px, calc(100svh - 20px))' : 'min(720px, calc(100svh - 48px))',
          overflow: 'hidden',
          border: '1px solid rgba(205,153,171,.2)',
          borderRadius: mobile ? 24 : 32,
          background: 'linear-gradient(180deg, rgba(255,253,253,.98), rgba(250,241,244,.98))',
          boxShadow: '0 30px 90px rgba(96,70,81,.18)',
          animation: 'pawcream-drawer-open 420ms cubic-bezier(.16,1,.3,1) both',
        }}
      >
        <header
          style={{
            height: mobile ? 70 : 78,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: mobile ? '0 18px' : '0 26px',
            borderBottom: '1px solid rgba(197,146,164,.15)',
            background: 'rgba(255,252,253,.9)',
          }}
        >
          <div>
            <strong style={{ display: 'block', fontSize: mobile ? 16 : 18, letterSpacing: '.04em' }}>
              {user.displayName} 的小抽屉
            </strong>
            <span style={{ display: 'block', marginTop: 4, fontSize: 10, color: '#aa8995' }}>
              {views.length ? `${views.length} 张拍立得` : '还没有放进照片'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭我的抽屉"
            style={{
              width: 36,
              height: 36,
              border: '1px solid rgba(188,140,158,.25)',
              borderRadius: '50%',
              background: 'rgba(255,255,255,.86)',
              color: '#9a7381',
              cursor: 'pointer',
              fontSize: 21,
            }}
          >
            ×
          </button>
        </header>

        <div
          style={{
            position: 'relative',
            height: `calc(100% - ${mobile ? 70 : 78}px)`,
            overflowY: 'auto',
            padding: mobile ? '34px 18px 110px' : '44px 54px 130px',
            perspective: 1000,
            background:
              'linear-gradient(90deg, rgba(137,94,106,.08), transparent 15%, transparent 85%, rgba(137,94,106,.08)), linear-gradient(180deg, rgba(255,255,255,.45), rgba(238,220,225,.5))',
          }}
        >
          {loading && (
            <div style={{ paddingTop: 60, textAlign: 'center', fontSize: 12, color: '#aa8995' }}>
              正在打开抽屉…
            </div>
          )}

          {!loading && views.length === 0 && (
            <div
              style={{
                minHeight: 360,
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                color: '#a88591',
              }}
            >
              <div>
                <div style={{ marginBottom: 12, fontSize: 30 }}>♡</div>
                <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                  去拍立得里做第一张照片吧
                  <br />
                  做好的照片会收进这里
                </div>
              </div>
            </div>
          )}

          {!loading && views.map((view, index) => {
            const rotation = ((index % 5) - 2) * 1.2
            const tilt = Math.max(18, 50 - Math.min(index, 6) * 4)
            const isNew = highlightedPhotoId === view.photo.id

            return (
              <button
                key={view.photo.id}
                type="button"
                className="pawcream-drawer-photo"
                onClick={(event) => openPhoto(view, event)}
                aria-label={`查看 ${formatDate(view.photo.createdAt)} 的拍立得`}
                style={{
                  display: 'block',
                  width: mobile ? 'min(235px, 72vw)' : 285,
                  aspectRatio: '0.78',
                  margin: index === 0 ? '0 auto' : mobile ? '-86px auto 0' : '-104px auto 0',
                  padding: 0,
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  transform: `perspective(900px) rotateX(${tilt}deg) rotateZ(${rotation}deg)`,
                  transformOrigin: '50% 100%',
                  position: 'relative',
                  zIndex: index + 1,
                  filter: index > 4 ? 'brightness(.97)' : 'none',
                  animation: isNew ? 'pawcream-drawer-new-photo 1.4s ease-in-out 2' : undefined,
                }}
              >
                <img
                  src={view.url}
                  alt=""
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    filter: 'drop-shadow(0 12px 18px rgba(87,67,74,.14))',
                    userSelect: 'none',
                  }}
                />
              </button>
            )
          })}

          <div
            aria-hidden="true"
            style={{
              position: 'sticky',
              bottom: -1,
              zIndex: 80,
              height: mobile ? 76 : 92,
              margin: mobile ? '10px -18px -110px' : '14px -54px -130px',
              borderTop: '1px solid rgba(157,111,124,.16)',
              background:
                'linear-gradient(180deg, rgba(243,224,229,.96), rgba(225,199,207,.98))',
              boxShadow: '0 -16px 34px rgba(106,76,86,.08), inset 0 1px rgba(255,255,255,.6)',
            }}
          />
        </div>
      </section>

      {focus && (
        <div
          role="presentation"
          onClick={() => void closePhoto()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 170,
            background: 'rgba(255,251,252,.64)',
            backdropFilter: 'blur(7px)',
            WebkitBackdropFilter: 'blur(7px)',
          }}
        >
          <button
            ref={focusRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              void closePhoto()
            }}
            aria-label="收回照片"
            style={{
              position: 'fixed',
              padding: 0,
              border: 0,
              background: 'transparent',
              cursor: 'zoom-out',
            }}
          >
            <img
              src={focus.view.url}
              alt={focus.view.photo.fileName || '我的拍立得'}
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', userSelect: 'none' }}
            />
          </button>

          <div
            style={{
              position: 'fixed',
              left: '50%',
              bottom: mobile ? 16 : 24,
              transform: 'translateX(-50%)',
              zIndex: 172,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 9px',
              border: '1px solid rgba(190,143,160,.22)',
              borderRadius: 999,
              background: 'rgba(255,253,253,.92)',
              boxShadow: '0 10px 30px rgba(93,70,78,.12)',
            }}
          >
            <span style={{ padding: '0 7px', fontSize: 10, color: '#a17d8a', whiteSpace: 'nowrap' }}>
              {formatDate(focus.view.photo.createdAt)}
            </span>
            <button
              type="button"
              disabled={deleting}
              onClick={(event) => {
                event.stopPropagation()
                void removeFocused()
              }}
              style={{
                minHeight: 32,
                padding: '0 13px',
                border: '1px solid rgba(195,140,160,.22)',
                borderRadius: 999,
                background: 'rgba(255,246,248,.95)',
                color: '#a06f80',
                cursor: deleting ? 'default' : 'pointer',
                opacity: deleting ? .55 : 1,
                fontSize: 11,
              }}
            >
              {deleting ? '正在收起…' : '从抽屉里拿走'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
