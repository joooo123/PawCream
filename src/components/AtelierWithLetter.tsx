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

const LETTER_URL = `${import.meta.env.BASE_URL}assets/atelier/letter.png?v=d2c0fa4f2a9e7dd15b36b2be0ce741f3d6b7f2fa`
const LANGUAGE_STORAGE_KEY = 'pawcream-language-v1'

const COPY = {
  zh: {
    eyebrow: 'A little note from PawCream',
    title: '关于 PawCream',
    body: 'PawCream 是一间收集柔软日常的小小工作室。我们喜欢纸张、照片、旧物和那些不急着说完的话，把微小的心情做成可以被看见、被保存的东西。希望你来到这里时，能慢一点，留下一点属于自己的痕迹。',
    signature: 'soft things · slow days · little keepsakes',
    close: '关闭品牌介绍',
  },
  en: {
    eyebrow: 'A little note from PawCream',
    title: 'About PawCream',
    body: 'PawCream is a tiny atelier for collecting soft pieces of everyday life. We love paper, photographs, old objects, and thoughts that do not need to be finished in a hurry. We turn small feelings into things that can be seen, kept, and returned to. We hope this little room gives you a reason to slow down and leave a trace of your own.',
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
            padding: mobile ? 14 : 28,
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
              width: mobile ? 'min(430px, calc(100vw - 28px))' : 'min(820px, calc(100vw - 56px))',
              maxHeight: 'calc(100svh - 28px)',
              overflow: 'auto',
              padding: mobile ? '18px 16px 22px' : '24px 28px 28px',
              border: '1px solid rgba(139, 177, 207, .34)',
              borderRadius: mobile ? 24 : 30,
              background: 'rgba(252, 254, 255, .97)',
              boxShadow: '0 30px 90px rgba(74, 108, 134, .2)',
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

            <button
              type="button"
              className="pawcream-letter-close"
              aria-label={copy.close}
              title={copy.close}
              onClick={() => setOpen(false)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                zIndex: 5,
                width: 38,
                height: 38,
                display: 'grid',
                placeItems: 'center',
                padding: 0,
                border: '1px solid rgba(134,174,205,.34)',
                borderRadius: '50%',
                background: 'rgba(255,255,255,.9)',
                color: '#6f8ca2',
                boxShadow: '0 5px 18px rgba(78,112,138,.08)',
                cursor: 'pointer',
                fontSize: 23,
                lineHeight: 1,
              }}
            >
              ×
            </button>

            <div
              style={{
                width: mobile ? '100%' : '88%',
                margin: '0 auto',
                filter: 'drop-shadow(0 16px 26px rgba(74,108,134,.13))',
              }}
            >
              <img
                src={LETTER_URL}
                alt="PawCream letter"
                draggable={false}
                decoding="async"
                style={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none' }}
              />
            </div>

            <div
              style={{
                width: mobile ? '100%' : '82%',
                margin: mobile ? '12px auto 0' : '16px auto 0',
                padding: mobile ? '14px 15px 15px' : '17px 22px 19px',
                border: '1px solid rgba(139,177,207,.2)',
                borderRadius: 18,
                background: 'rgba(237,247,254,.72)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  color: '#7b96aa',
                  fontSize: mobile ? 13 : 15,
                  letterSpacing: '.06em',
                  marginBottom: 7,
                  fontFamily: "'PawCream EN', sans-serif",
                }}
              >
                {copy.eyebrow}
              </div>
              <h2
                style={{
                  margin: 0,
                  color: '#527792',
                  fontSize: mobile ? 24 : 29,
                  fontWeight: 400,
                  lineHeight: 1.25,
                }}
              >
                {copy.title}
              </h2>
              <p
                style={{
                  margin: mobile ? '10px 0 0' : '12px 0 0',
                  color: '#648198',
                  fontSize: mobile ? 16 : 18,
                  lineHeight: language === 'zh' ? 1.9 : 1.72,
                  textAlign: language === 'zh' ? 'left' : 'center',
                }}
              >
                {copy.body}
              </p>
              <div
                style={{
                  marginTop: 12,
                  color: '#88a2b5',
                  fontSize: mobile ? 12 : 14,
                  letterSpacing: '.04em',
                  fontFamily: "'PawCream EN', sans-serif",
                }}
              >
                {copy.signature}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
