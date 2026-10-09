import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AUTH_CHANGED_EVENT,
  getCurrentUser,
  openPawCreamSignin,
  type PawCreamUser,
} from '../pawcreamApi'
import { saveDrawerPhoto } from '../pawcreamPhotoDrawer'
import AtelierPlaceholderV2 from './AtelierPlaceholderV2'
import PawCreamPhotoDrawer from './PawCreamPhotoDrawer'

type DeviceProfile = 'desktop' | 'mobile'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

type InstaxStep = 'pick' | 'upload'

type FrameConfig = {
  src: string
  width: number
  height: number
  hole: { left: number; top: number; width: number; height: number }
}

const frameUrl = (name: string, version: string) =>
  `${import.meta.env.BASE_URL}assets/instax/${name}?v=${version}`

const INSTAX_FRAMES: FrameConfig[] = [
  {
    src: frameUrl('instax-frame-01.png', '04c9827dc2811bad94346fc170ea03f9ac745df4'),
    width: 311,
    height: 425,
    hole: { left: 11.897, top: 11.765, width: 76.527, height: 63.765 },
  },
  {
    src: frameUrl('instax-frame-02.png', '1438a056912d110eddf2e62423b1f1dd015f5b49'),
    width: 329,
    height: 455,
    hole: { left: 17.325, top: 16.923, width: 62.918, height: 57.582 },
  },
  {
    src: frameUrl('instax-frame-03.png', 'aa70f581698019f28a25f541aab0b1fc729b84ff'),
    width: 371,
    height: 459,
    hole: { left: 19.946, top: 17.865, width: 65.229, height: 57.516 },
  },
  {
    src: frameUrl('instax-frame-04.png', 'd9baa7ee96d0dd00662397eb90c70f793ab753f6'),
    width: 330,
    height: 458,
    hole: { left: 13.03, top: 24.236, width: 72.424, height: 50.218 },
  },
  {
    src: frameUrl('instax-frame-05.png', 'bf8dbd4f5755c12782c35f4eeb1acf74cf061299'),
    width: 319,
    height: 420,
    hole: { left: 14.734, top: 16.667, width: 70.219, height: 57.143 },
  },
  {
    src: frameUrl('instax-frame-06.png', '010ea0ec9fbef2d8af3773094df4d66370087871'),
    width: 336,
    height: 399,
    hole: { left: 14.583, top: 14.035, width: 70.238, height: 61.404 },
  },
  {
    src: frameUrl('instax-frame-07.png', '5be27d6331c46d0c8f0dfc946f5921b809bdf8fd'),
    width: 422,
    height: 406,
    hole: { left: 23.697, top: 20.69, width: 65.166, height: 55.172 },
  },
  {
    src: frameUrl('instax-frame-08.png', '980d169312a17db8b6ba637c63e8ee052ffedaa9'),
    width: 379,
    height: 382,
    hole: { left: 16.623, top: 16.23, width: 65.963, height: 56.806 },
  },
]

const modalButtonStyle = {
  border: '1px solid rgba(187, 145, 162, .28)',
  background: 'rgba(255,255,255,.92)',
  color: '#8f6f7b',
  boxShadow: '0 5px 18px rgba(98, 74, 83, .08)',
  cursor: 'pointer',
} as const

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片读取失败'))
    image.src = src
  })
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceRatio = image.naturalWidth / image.naturalHeight
  const targetRatio = width / height
  let sx = 0
  let sy = 0
  let sw = image.naturalWidth
  let sh = image.naturalHeight

  if (sourceRatio > targetRatio) {
    sw = image.naturalHeight * targetRatio
    sx = (image.naturalWidth - sw) / 2
  } else {
    sh = image.naturalWidth / targetRatio
    sy = (image.naturalHeight - sh) / 2
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height)
}

async function buildInstaxBlob(photoUrl: string, frame: FrameConfig) {
  const [photo, frameImage] = await Promise.all([
    loadImage(photoUrl),
    loadImage(frame.src),
  ])

  const outputScale = 2
  const canvas = document.createElement('canvas')
  canvas.width = frame.width * outputScale
  canvas.height = frame.height * outputScale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法生成拍立得')

  ctx.scale(outputScale, outputScale)
  const x = frame.width * frame.hole.left / 100
  const y = frame.height * frame.hole.top / 100
  const width = frame.width * frame.hole.width / 100
  const height = frame.height * frame.hole.height / 100

  drawCover(ctx, photo, x, y, width, height)
  ctx.drawImage(frameImage, 0, 0, frame.width, frame.height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('无法保存拍立得')),
      'image/webp',
      .9,
    )
  })
}

export default function AtelierWithInstax(props: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<InstaxStep>('pick')
  const [frameIndex, setFrameIndex] = useState(0)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoName, setPhotoName] = useState('')
  const [currentUser, setCurrentUser] = useState<PawCreamUser | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerHighlightId, setDrawerHighlightId] = useState<string | null>(null)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const tuneMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tune') === '1',
    [],
  )

  const currentFrame = INSTAX_FRAMES[frameIndex]
  const mobile = props.deviceProfile === 'mobile'

  const refreshCurrentUser = async () => {
    try {
      setCurrentUser(await getCurrentUser())
    } catch {
      setCurrentUser(null)
    }
  }

  useEffect(() => {
    void refreshCurrentUser()
    const onAuthChanged = () => void refreshCurrentUser()
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
  }, [])

  const clearPhoto = () => {
    setPhotoUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setPhotoName('')
  }

  const closeInstax = () => {
    setOpen(false)
    setStep('pick')
    setSaveStatus('')
    clearPhoto()
  }

  const openInstax = () => {
    clearPhoto()
    setFrameIndex(Math.floor(Math.random() * INSTAX_FRAMES.length))
    setStep('pick')
    setOpen(true)
  }

  useEffect(() => {
    if (tuneMode) return

    const image = document.querySelector<HTMLImageElement>(
      'section[aria-label^="PawCream Atelier Room"] img[alt="Instax"]',
    )
    const control = image?.parentElement
    if (!control) return

    const oldRole = control.getAttribute('role')
    const oldTabIndex = control.getAttribute('tabindex')
    const oldLabel = control.getAttribute('aria-label')
    const oldCursor = control.style.cursor

    control.setAttribute('role', 'button')
    control.setAttribute('tabindex', '0')
    control.setAttribute('aria-label', 'Instax interaction')
    control.style.cursor = 'pointer'

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('[aria-label="Instax interaction"]')) return
      openInstax()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const target = event.target as Element | null
      if (!target?.closest('[aria-label="Instax interaction"]')) return
      event.preventDefault()
      openInstax()
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

  useEffect(() => {
    if (tuneMode) return

    const image = document.querySelector<HTMLImageElement>(
      'section[aria-label^="PawCream Atelier Room"] img[alt="Wall cabinet"]',
    )
    const control = image?.parentElement
    if (!control) return

    const oldRole = control.getAttribute('role')
    const oldTabIndex = control.getAttribute('tabindex')
    const oldLabel = control.getAttribute('aria-label')
    const oldCursor = control.style.cursor

    control.setAttribute('role', 'button')
    control.setAttribute('tabindex', '0')
    control.setAttribute('aria-label', 'Open my photo drawer')
    control.style.cursor = 'pointer'

    const openDrawer = () => {
      if (!currentUser) {
        openPawCreamSignin('login')
        return
      }
      setDrawerHighlightId(null)
      setDrawerOpen(true)
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('[aria-label="Open my photo drawer"]')) return
      openDrawer()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const target = event.target as Element | null
      if (!target?.closest('[aria-label="Open my photo drawer"]')) return
      event.preventDefault()
      openDrawer()
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
  }, [currentUser, props.deviceProfile, tuneMode])

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
  }, [photoUrl])

  const shiftFrame = (direction: -1 | 1) => {
    clearPhoto()
    setFrameIndex((current) =>
      (current + direction + INSTAX_FRAMES.length) % INSTAX_FRAMES.length,
    )
  }

  const proceedToPhoto = () => {
    setStep('upload')
    inputRef.current?.click()
  }

  const choosePhoto = () => inputRef.current?.click()

  const saveToDrawer = async () => {
    if (!photoUrl || savingPhoto) return
    if (!currentUser) {
      setSaveStatus('登入后才能把照片收进自己的抽屉')
      openPawCreamSignin('login')
      return
    }

    setSavingPhoto(true)
    setSaveStatus('正在收进抽屉…')
    try {
      const imageBlob = await buildInstaxBlob(photoUrl, currentFrame)
      const saved = await saveDrawerPhoto({
        ownerId: currentUser.id,
        ownerName: currentUser.displayName,
        imageBlob,
        fileName: photoName || 'PawCream Instax',
        frameIndex,
      })
      setDrawerHighlightId(saved.id)
      setOpen(false)
      setStep('pick')
      clearPhoto()
      setSaveStatus('')
      setDrawerOpen(true)
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : '照片保存失败')
    } finally {
      setSavingPhoto(false)
    }
  }

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return

    setPhotoUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })
    setPhotoName(file.name)
    setSaveStatus('')
    event.currentTarget.value = ''
  }

  const composite = (maxWidth: number) => (
    <div
      style={{
        position: 'relative',
        width: `min(${maxWidth}px, 68vw)`,
        maxWidth: '100%',
        aspectRatio: `${currentFrame.width} / ${currentFrame.height}`,
        margin: '0 auto',
        filter: 'drop-shadow(0 14px 22px rgba(99, 78, 87, .13))',
      }}
    >
      {photoUrl && (
        <img
          src={photoUrl}
          alt="Selected upload"
          draggable={false}
          style={{
            position: 'absolute',
            left: `${currentFrame.hole.left}%`,
            top: `${currentFrame.hole.top}%`,
            width: `${currentFrame.hole.width}%`,
            height: `${currentFrame.hole.height}%`,
            objectFit: 'cover',
            zIndex: 1,
            userSelect: 'none',
          }}
        />
      )}
      <img
        src={currentFrame.src}
        alt={`Instax frame ${frameIndex + 1}`}
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          zIndex: 2,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
    </div>
  )

  return (
    <>
      <AtelierPlaceholderV2 {...props} />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />

      {open && !tuneMode && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 130,
            display: 'grid',
            placeItems: 'center',
            padding: mobile ? 12 : 24,
            background: 'rgba(255, 249, 251, .58)',
            backdropFilter: 'blur(9px)',
            WebkitBackdropFilter: 'blur(9px)',
          }}
        >
          <style>{`
            .pawcream-instax-close,
            .pawcream-instax-arrow,
            .pawcream-instax-ok,
            .pawcream-instax-file {
              transition: background 160ms ease, color 160ms ease, transform 160ms ease, border-color 160ms ease;
            }
            .pawcream-instax-close:hover {
              background: #d993ab !important;
              color: white !important;
              border-color: #d993ab !important;
              transform: rotate(7deg) scale(1.06);
            }
            .pawcream-instax-arrow:hover,
            .pawcream-instax-ok:hover,
            .pawcream-instax-file:hover {
              background: #f7e5ec !important;
              color: #a7657e !important;
              border-color: rgba(194, 118, 148, .32) !important;
              transform: translateY(-1px);
            }
            .pawcream-instax-arrow:active,
            .pawcream-instax-ok:active,
            .pawcream-instax-file:active {
              transform: translateY(1px) scale(.98);
            }
          `}</style>

          <section
            role="dialog"
            aria-modal="true"
            aria-label="Pick an Instax frame"
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'relative',
              width: mobile ? 'min(390px, calc(100vw - 24px))' : 'min(470px, calc(100vw - 48px))',
              maxHeight: 'calc(100svh - 24px)',
              overflow: 'auto',
              padding: mobile ? '28px 20px 22px' : '34px 30px 28px',
              border: '1px solid rgba(203, 153, 173, .22)',
              borderRadius: mobile ? 24 : 30,
              background: 'rgba(255, 253, 253, .97)',
              boxShadow: '0 30px 90px rgba(96, 70, 81, .2)',
              color: '#80636d',
              fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            <button
              type="button"
              className="pawcream-instax-close"
              aria-label="Close Instax picker"
              title="Close"
              onClick={closeInstax}
              style={{
                ...modalButtonStyle,
                position: 'absolute',
                top: 12,
                right: 12,
                width: 34,
                height: 34,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                padding: 0,
                fontSize: 21,
                lineHeight: 1,
                zIndex: 4,
              }}
            >
              ×
            </button>

            {step === 'pick' ? (
              <>
                <div
                  style={{
                    margin: '0 44px 18px',
                    textAlign: 'center',
                    fontSize: mobile ? 19 : 22,
                    fontWeight: 700,
                    letterSpacing: '.04em',
                    color: '#8c6d78',
                  }}
                >
                  pick one!
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '46px minmax(0, 1fr) 46px', alignItems: 'center', gap: mobile ? 6 : 10 }}>
                  <button
                    type="button"
                    className="pawcream-instax-arrow"
                    aria-label="Previous frame"
                    onClick={() => shiftFrame(-1)}
                    style={{ ...modalButtonStyle, width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', padding: 0 }}
                  >
                    <span aria-hidden="true" style={{ width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderRight: '13px solid currentColor', marginLeft: -3 }} />
                  </button>

                  <div>
                    {composite(mobile ? 250 : 285)}
                    <div style={{ marginTop: 10, textAlign: 'center', fontSize: 10, color: '#b0909b', fontVariantNumeric: 'tabular-nums' }}>
                      {frameIndex + 1} / {INSTAX_FRAMES.length}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="pawcream-instax-arrow"
                    aria-label="Next frame"
                    onClick={() => shiftFrame(1)}
                    style={{ ...modalButtonStyle, width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', padding: 0 }}
                  >
                    <span aria-hidden="true" style={{ width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: '13px solid currentColor', marginRight: -3 }} />
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: mobile ? 18 : 22 }}>
                  <button
                    type="button"
                    className="pawcream-instax-ok"
                    onClick={proceedToPhoto}
                    style={{
                      ...modalButtonStyle,
                      minWidth: 112,
                      minHeight: 42,
                      borderRadius: 999,
                      padding: '9px 25px',
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    ok!
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    margin: '0 44px 18px',
                    textAlign: 'center',
                    fontSize: mobile ? 18 : 21,
                    fontWeight: 700,
                    letterSpacing: '.025em',
                    color: '#8c6d78',
                  }}
                >
                  {photoUrl ? 'your instax!' : 'pick a photo!'}
                </div>

                {photoUrl ? (
                  <>
                    {composite(mobile ? 270 : 310)}
                    {photoName && (
                      <div style={{ margin: '12px auto 0', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center', fontSize: 10, color: '#af8e99' }}>
                        {photoName}
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      minHeight: mobile ? 270 : 320,
                      display: 'grid',
                      placeItems: 'center',
                      padding: 16,
                      border: '1px dashed rgba(191, 137, 158, .3)',
                      borderRadius: 22,
                      background: 'rgba(252, 246, 248, .65)',
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ marginBottom: 10, fontSize: 34, lineHeight: 1 }}>♡</div>
                      <div style={{ fontSize: 11, color: '#a78691', lineHeight: 1.6 }}>
                        choose a photo from your device
                      </div>
                    </div>
                  </div>
                )}

                {photoUrl && (
                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <button
                      type="button"
                      className="pawcream-instax-ok"
                      disabled={savingPhoto}
                      onClick={() => void saveToDrawer()}
                      style={{
                        ...modalButtonStyle,
                        minHeight: 42,
                        borderRadius: 999,
                        padding: '9px 24px',
                        background: '#fff0f4',
                        color: '#a6667d',
                        fontSize: 13,
                        fontWeight: 750,
                        opacity: savingPhoto ? .58 : 1,
                        cursor: savingPhoto ? 'default' : 'pointer',
                      }}
                    >
                      {savingPhoto ? '正在收好…' : '收进我的抽屉 ♡'}
                    </button>
                    {saveStatus && (
                      <div style={{ marginTop: 8, fontSize: 10, color: '#a9808e', lineHeight: 1.5 }}>
                        {saveStatus}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', gap: 9, flexWrap: 'wrap', marginTop: 14 }}>
                  <button
                    type="button"
                    className="pawcream-instax-file"
                    onClick={choosePhoto}
                    style={{ ...modalButtonStyle, minHeight: 40, borderRadius: 999, padding: '8px 20px', fontSize: 12, fontWeight: 650 }}
                  >
                    {photoUrl ? 'choose another' : 'choose photo'}
                  </button>
                  <button
                    type="button"
                    className="pawcream-instax-file"
                    onClick={() => {
                      clearPhoto()
                      setStep('pick')
                    }}
                    style={{ ...modalButtonStyle, minHeight: 40, borderRadius: 999, padding: '8px 18px', fontSize: 12 }}
                  >
                    back
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {drawerOpen && currentUser && !tuneMode && (
        <PawCreamPhotoDrawer
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false)
            setDrawerHighlightId(null)
          }}
          user={currentUser}
          mobile={mobile}
          highlightedPhotoId={drawerHighlightId}
        />
      )}
    </>
  )
}
