import { useEffect, useMemo, useState } from 'react'
import AtelierWithInstax from './AtelierWithInstax'

type DeviceProfile = 'desktop' | 'mobile'
type Language = 'zh' | 'en'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

const LETTER_URL = `${import.meta.env.BASE_URL}assets/atelier/letter.png?v=b11841236724eb09d8b7e7940a4a9b76e0f91ac2`
const LANGUAGE_STORAGE_KEY = 'pawcream-language-v1'

const COPY = {
  zh: {
    title: '关于 PawCream',
    body: 'PawCream 是一间收集柔软日常的小小工作室。我们喜欢纸张、照片、旧物和那些来不及一下子说完的话，也相信每一点细小心情，都值得被温柔保存。希望你来到这里时，可以慢一点，也留下属于自己的痕迹。',
    signature: 'soft things · slow days · little keepsakes',
    close: '关闭品牌介绍',
  },
  en: {
    title: 'About PawCream',
    body: 'PawCream is a tiny atelier for soft everyday moments. We love paper, photographs, old objects, and thoughts that do not need to be said all at once. We believe even the smallest feelings deserve to be kept gently. We hope this little room lets you slow down and leave a trace of your own.',
    signature: 'soft things · slow days · little keepsakes',
    close: 'Close brand introduction',
  },
} as const

function readLanguage(): Language {
  if (typeof window === 'undefined') return 'zh'
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh'
}

export default function AtelierWithLetter(props: Props) {
  const [open, setOpen] = useState(false)
  const [language, setLanguage] = useState<Language>(readLanguage)

  const tuneMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tune') === '1',
    [],
  )

  const mobile = props.deviceProfile === 'mobile'
  const copy = COPY[language]

  const openLetter = () => {
    setLanguage(readLanguage())
    setOpen(true)
  }

  useEffect(() => {
    if (tuneMode) return

    const image = document.querySelector<HTMLImageElement>(
      'section[aria-label^="PawCream Atelier Room"] img[alt="Window"], section[aria-label^="PawCream Atelier Room"] img[alt="PawCream"]',
    )
    const control = image?.parentElement
    if (!control) return

    const oldRole = control.getAttribute('role')
    const oldTabIndex = control.getAttribute('tabindex')
    const oldLabel = control.getAttribute('aria-label')
    const oldCursor = control.style.cursor

    control.setAttribute('role', 'button')
    control.setAttribute('tabindex', '0')
    control.setAttribute('aria-label', 'Window interaction')
    control.style.cursor = 'pointer'

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('[aria-label="Window interaction"]')) return
      openLetter()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        setOpen(false)
        return
      }
      if (event.key !== 'Enter' && event.key !== ' ') return
      const target = event.target as Element | null
      if (!target?.closest('[aria-label="Window interaction"]')) return
      event.preventDefault()
      openLetter()
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
  }, [props.deviceProfile, tuneMode, open])

  return (
    <>
      <AtelierWithInstax {...props} />

      {open && !tuneMode && (
        <div
          role="presentation"
          className="pawcream-letter-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 145,
            display: 'grid',
            placeItems: 'center',
            padding: mobile ? 12 : 24,
            background: 'rgba(211, 228, 242, .48)',
            backdropFilter: 'blur(11px) saturate(112%)',
            WebkitBackdropFilter: 'blur(11px) saturate(112%)',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'relative',
              width: mobile ? 'min(520px, calc(100vw - 24px))' : 'min(860px, calc(100vw - 48px))',
              maxHeight: 'calc(100svh - 24px)',
              overflow: 'visible',
              padding: 0,
              border: 0,
              background: 'transparent',
              boxShadow: 'none',
              color: '#58758b',
              fontFamily: language === 'zh'
                ? "'PawCream CN', 'PawCream EN', sans-serif"
                : "'PawCream EN', sans-serif",
            }}
          >
            <style>{`
              .pawcream-letter-close {
                transition: background 160ms ease, color 160ms ease, transform 160ms ease, border-color 160ms ease;
              }
              .pawcream-letter-close:hover {
                background: #dbeaf6 !important;
                color: #426b88 !important;
                border-color: rgba(105,155,192,.48) !important;
                transform: rotate(7deg) scale(1.06);
              }
            `}</style>

            <div
              style={{
                position: 'relative',
                width: '100%',
                filter: 'drop-shadow(0 22px 34px rgba(74,108,134,.18))',
              }}
            >
              <img
                src={LETTER_URL}
                alt="PawCream letter"
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

              <div
                style={{
                  position: 'absolute',
                  left: mobile ? '22%' : '20%',
                  top: mobile ? '20%' : '19%',
                  width: mobile ? '56%' : '60%',
                  height: mobile ? '54%' : '57%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  color: '#5b798f',
                  textAlign: language === 'zh' ? 'left' : 'center',
                  boxSizing: 'border-box',
                  padding: mobile ? '0 3%' : '0 4%',
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    color: '#527792',
                    fontSize: mobile ? 21 : 31,
                    fontWeight: 400,
                    lineHeight: 1.25,
                    textAlign: 'center',
                  }}
                >
                  {copy.title}
                </h2>

                <p
                  style={{
                    margin: mobile ? '8px 0 0' : '12px 0 0',
                    color: '#648198',
                    fontSize: mobile ? 12 : 17,
                    lineHeight: language === 'zh' ? 1.82 : 1.58,
                    letterSpacing: language === 'zh' ? '.015em' : '.005em',
                  }}
                >
                  {copy.body}
                </p>

                <div
                  style={{
                    marginTop: mobile ? 8 : 13,
                    color: '#88a2b5',
                    fontSize: mobile ? 9 : 13,
                    lineHeight: 1.35,
                    textAlign: 'center',
                    letterSpacing: '.04em',
                    fontFamily: "'PawCream EN', sans-serif",
                  }}
                >
                  {copy.signature}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="pawcream-letter-close"
              aria-label={copy.close}
              title={copy.close}
              onClick={() => setOpen(false)}
              style={{
                position: 'absolute',
                top: mobile ? -4 : 4,
                right: mobile ? -2 : 5,
                zIndex: 5,
                width: mobile ? 34 : 40,
                height: mobile ? 34 : 40,
                display: 'grid',
                placeItems: 'center',
                padding: 0,
                border: '1px solid rgba(134,174,205,.34)',
                borderRadius: '50%',
                background: 'rgba(255,255,255,.9)',
                color: '#6f8ca2',
                boxShadow: '0 5px 18px rgba(78,112,138,.11)',
                cursor: 'pointer',
                fontSize: mobile ? 20 : 24,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </section>
        </div>
      )}
    </>
  )
}
