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

const BASE_URL = import.meta.env.BASE_URL
const ENVELOPE_BACK_URL = `${BASE_URL}assets/envelop/back.png?v=3a546f1b`
const ENVELOPE_PAPER_URL = `${BASE_URL}assets/envelop/paper.png?v=fb2c4889`
const ENVELOPE_FRONT_URL = `${BASE_URL}assets/envelop/front.png?v=11bca0e4`
const LANGUAGE_STORAGE_KEY = 'pawcream-language-v1'
const PAPER_RISE_MS = 1650

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
  const [typedChars, setTypedChars] = useState(0)

  const tuneMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tune') === '1',
    [],
  )

  const mobile = props.deviceProfile === 'mobile'
  const copy = COPY[language]
  const titleLength = copy.title.length
  const totalTypingLength = titleLength + copy.body.length
  const visibleTitle = copy.title.slice(0, Math.min(typedChars, titleLength))
  const visibleBody = copy.body.slice(0, Math.max(0, typedChars - titleLength))
  const typingTitle = typedChars < titleLength
  const typingBody = typedChars >= titleLength && typedChars < totalTypingLength
  const typingDone = typedChars >= totalTypingLength

  const openLetter = () => {
    setLanguage(readLanguage())
    setTypedChars(0)
    setOpen(true)
  }

  useEffect(() => {
    if (tuneMode) return

    const timer = window.setTimeout(() => {
      for (const src of [ENVELOPE_BACK_URL, ENVELOPE_PAPER_URL, ENVELOPE_FRONT_URL]) {
        const image = new Image()
        image.decoding = 'async'
        image.src = src
      }
    }, 220)

    return () => window.clearTimeout(timer)
  }, [tuneMode])

  useEffect(() => {
    if (!open) {
      setTypedChars(0)
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTypedChars(totalTypingLength)
      return
    }

    let timeoutId = 0
    let current = 0
    const delay = language === 'zh' ? 54 : 29

    const step = () => {
      current += 1
      setTypedChars(current)
      if (current < totalTypingLength) {
        timeoutId = window.setTimeout(step, delay)
      }
    }

    timeoutId = window.setTimeout(step, PAPER_RISE_MS - 120)
    return () => window.clearTimeout(timeoutId)
  }, [open, language, totalTypingLength])

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
            padding: mobile ? 10 : 22,
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
            className={`pawcream-envelope-dialog${mobile ? ' is-mobile' : ''}`}
            style={{
              position: 'relative',
              width: mobile
                ? 'min(540px, calc(100vw - 12px))'
                : 'min(900px, calc(100vw - 38px))',
              maxHeight: 'calc(100svh - 12px)',
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
              .pawcream-envelope-stage {
                position: relative;
                width: 100%;
                aspect-ratio: 4 / 3;
                isolation: isolate;
                filter: drop-shadow(0 22px 34px rgba(74,108,134,.16));
                animation: pawcream-envelope-enter 360ms ease-out both;
              }
              .pawcream-envelope-layer {
                position: absolute;
                inset: 0;
                display: block;
                width: 100%;
                height: 100%;
                object-fit: contain;
                user-select: none;
                pointer-events: none;
              }
              .pawcream-envelope-back {
                z-index: 1;
              }
              .pawcream-envelope-paper-wrap {
                position: absolute;
                inset: 0;
                z-index: 2;
                transform-origin: 50% 78%;
                animation: pawcream-paper-rise ${PAPER_RISE_MS}ms cubic-bezier(.2,.76,.28,1) both;
                will-change: transform;
              }
              .pawcream-envelope-paper {
                z-index: 1;
              }
              .pawcream-envelope-front {
                z-index: 3;
              }
              .pawcream-paper-copy {
                position: absolute;
                z-index: 2;
                left: 22%;
                top: 12.5%;
                width: 56%;
                height: 44%;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                align-items: stretch;
                justify-content: flex-start;
                overflow: hidden;
                color: #5b798f;
                pointer-events: none;
              }
              .pawcream-paper-title {
                min-height: 1.35em;
                margin: 0;
                color: #527792;
                font-size: 29px;
                font-weight: 400;
                line-height: 1.28;
                text-align: center;
              }
              .pawcream-paper-body {
                margin: 12px 0 0;
                color: #648198;
                font-size: 16px;
                line-height: 1.72;
                letter-spacing: .012em;
                text-align: left;
              }
              .pawcream-paper-signature {
                margin-top: 12px;
                color: #88a2b5;
                font-family: 'PawCream EN', sans-serif;
                font-size: 12px;
                line-height: 1.35;
                letter-spacing: .04em;
                text-align: center;
                opacity: 0;
                transform: translateY(3px);
                transition: opacity 520ms ease, transform 520ms ease;
              }
              .pawcream-paper-signature.is-visible {
                opacity: 1;
                transform: translateY(0);
              }
              .pawcream-type-caret {
                display: inline-block;
                width: .08em;
                height: .95em;
                margin-left: .12em;
                vertical-align: -.08em;
                border-right: 1.5px solid currentColor;
                animation: pawcream-caret-blink 720ms steps(1,end) infinite;
              }
              .pawcream-letter-close {
                transition: background 160ms ease, color 160ms ease, transform 160ms ease, border-color 160ms ease;
              }
              .pawcream-letter-close:hover {
                background: #dbeaf6 !important;
                color: #426b88 !important;
                border-color: rgba(105,155,192,.48) !important;
                transform: rotate(7deg) scale(1.06);
              }
              @keyframes pawcream-envelope-enter {
                from { opacity: 0; transform: translateY(8px) scale(.985); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
              @keyframes pawcream-paper-rise {
                0% { transform: translate3d(0, 23%, 0) scale(.94); }
                18% { transform: translate3d(0, 23%, 0) scale(.94); }
                100% { transform: translate3d(0, -10%, 0) scale(.94); }
              }
              @keyframes pawcream-caret-blink {
                0%, 46% { opacity: 1; }
                47%, 100% { opacity: 0; }
              }
              .pawcream-envelope-dialog.is-mobile .pawcream-paper-copy {
                left: 22%;
                top: 11.5%;
                width: 56%;
                height: 45%;
              }
              .pawcream-envelope-dialog.is-mobile .pawcream-paper-title {
                font-size: 20px;
              }
              .pawcream-envelope-dialog.is-mobile .pawcream-paper-body {
                margin-top: 7px;
                font-size: 11px;
                line-height: 1.62;
              }
              .pawcream-envelope-dialog.is-mobile .pawcream-paper-signature {
                margin-top: 7px;
                font-size: 8.5px;
              }
              @media (max-height: 690px) and (min-width: 701px) {
                .pawcream-envelope-dialog {
                  width: min(760px, calc(100vw - 38px)) !important;
                }
              }
              @media (prefers-reduced-motion: reduce) {
                .pawcream-envelope-stage,
                .pawcream-envelope-paper-wrap,
                .pawcream-type-caret {
                  animation: none !important;
                }
                .pawcream-envelope-paper-wrap {
                  transform: translate3d(0, -10%, 0) scale(.94);
                }
                .pawcream-paper-signature {
                  opacity: 1;
                  transform: none;
                }
              }
            `}</style>

            <div className="pawcream-envelope-stage">
              <img
                src={ENVELOPE_BACK_URL}
                alt=""
                aria-hidden="true"
                draggable={false}
                decoding="async"
                className="pawcream-envelope-layer pawcream-envelope-back"
              />

              <div className="pawcream-envelope-paper-wrap">
                <img
                  src={ENVELOPE_PAPER_URL}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  decoding="async"
                  className="pawcream-envelope-layer pawcream-envelope-paper"
                />

                <div
                  className="pawcream-paper-copy"
                  style={{
                    fontFamily: language === 'zh'
                      ? "'PawCream CN', 'PawCream EN', sans-serif"
                      : "'PawCream EN', sans-serif",
                  }}
                >
                  <h2 className="pawcream-paper-title">
                    {visibleTitle}
                    {typingTitle && <span className="pawcream-type-caret" aria-hidden="true" />}
                  </h2>

                  <p
                    className="pawcream-paper-body"
                    style={{
                      lineHeight: language === 'zh' ? 1.76 : 1.58,
                      letterSpacing: language === 'zh' ? '.015em' : '.005em',
                    }}
                  >
                    {visibleBody}
                    {typingBody && <span className="pawcream-type-caret" aria-hidden="true" />}
                  </p>

                  <div className={`pawcream-paper-signature${typingDone ? ' is-visible' : ''}`}>
                    {copy.signature}
                  </div>
                </div>
              </div>

              <img
                src={ENVELOPE_FRONT_URL}
                alt=""
                aria-hidden="true"
                draggable={false}
                decoding="async"
                className="pawcream-envelope-layer pawcream-envelope-front"
              />
            </div>

            <button
              type="button"
              className="pawcream-letter-close"
              aria-label={copy.close}
              title={copy.close}
              onClick={() => setOpen(false)}
              style={{
                position: 'absolute',
                top: mobile ? -2 : 4,
                right: mobile ? 2 : 5,
                zIndex: 8,
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
