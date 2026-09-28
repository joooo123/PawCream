import { useEffect, useMemo, useState } from 'react'
import AtelierWithInstax from './AtelierWithInstax'

type DeviceProfile = 'desktop' | 'mobile'
type Language = 'zh' | 'en'
type PreviewMode = 'play' | 'start' | 'end'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

type LetterTune = {
  paperLeft: number
  paperTop: number
  paperWidth: number
  paperHeight: number
  paperScale: number
  paperRotate: number
  startY: number
  endY: number
  textLeft: number
  textTop: number
  textWidth: number
  textHeight: number
  titleSize: number
  bodySize: number
  bodyLineHeight: number
  signatureSize: number
  riseMs: number
  typeGapMs: number
  typeDelayZh: number
  typeDelayEn: number
}

type LetterTuneProfiles = Record<DeviceProfile, LetterTune>

const BASE_URL = import.meta.env.BASE_URL
const ENVELOPE_BACK_URL = `${BASE_URL}assets/envelop/back.png?v=3a546f1b`
const ENVELOPE_PAPER_URL = `${BASE_URL}assets/envelop/paper.png?v=d54ae4f8`
const ENVELOPE_FRONT_URL = `${BASE_URL}assets/envelop/front.png?v=11bca0e4`
const LANGUAGE_STORAGE_KEY = 'pawcream-language-v1'
const LETTER_TUNE_STORAGE_KEY = 'pawcream-letter-tune-v1'
const PAPER_START_DELAY_MS = 120

const DEFAULT_TUNE: LetterTuneProfiles = {
  desktop: {
    paperLeft: 11.5,
    paperTop: -20,
    paperWidth: 82,
    paperHeight: 86,
    paperScale: 0.88,
    paperRotate: 0,
    startY: 35,
    endY: 9,
    textLeft: 18,
    textTop: 13,
    textWidth: 64,
    textHeight: 54,
    titleSize: 31.5,
    bodySize: 18.5,
    bodyLineHeight: 1.76,
    signatureSize: 21.5,
    riseMs: 4000,
    typeGapMs: 180,
    typeDelayZh: 58,
    typeDelayEn: 32,
  },
  mobile: {
    paperLeft: 14,
    paperTop: 5.5,
    paperWidth: 75.5,
    paperHeight: 84,
    paperScale: 0.88,
    paperRotate: 0,
    startY: 5,
    endY: -16,
    textLeft: 19.5,
    textTop: 16.5,
    textWidth: 64.5,
    textHeight: 56,
    titleSize: 19,
    bodySize: 10.5,
    bodyLineHeight: 1.62,
    signatureSize: 8,
    riseMs: 1550,
    typeGapMs: 180,
    typeDelayZh: 58,
    typeDelayEn: 32,
  },
}

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

function readTuneProfiles(): LetterTuneProfiles {
  if (typeof window === 'undefined') return DEFAULT_TUNE
  try {
    const saved = JSON.parse(window.localStorage.getItem(LETTER_TUNE_STORAGE_KEY) || '{}') as Partial<LetterTuneProfiles>
    return {
      desktop: { ...DEFAULT_TUNE.desktop, ...(saved.desktop || {}) },
      mobile: { ...DEFAULT_TUNE.mobile, ...(saved.mobile || {}) },
    }
  } catch {
    return DEFAULT_TUNE
  }
}

type TuneControlProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}

function TuneControl({ label, value, min, max, step = 1, suffix = '', onChange }: TuneControlProps) {
  return (
    <label className="pawcream-letter-tune-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <em>{suffix}</em>
    </label>
  )
}

export default function AtelierWithLetter(props: Props) {
  const [open, setOpen] = useState(false)
  const [language, setLanguage] = useState<Language>(readLanguage)
  const [typedChars, setTypedChars] = useState(0)
  const [paperRaised, setPaperRaised] = useState(false)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('play')
  const [playKey, setPlayKey] = useState(0)
  const [tuneProfiles, setTuneProfiles] = useState<LetterTuneProfiles>(readTuneProfiles)
  const [copyStatus, setCopyStatus] = useState('')
  const [dirty, setDirty] = useState(false)

  const query = useMemo(
    () => typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search),
    [],
  )
  const tuneMode = query.get('tune') === '1'
  const letterTuneMode = query.get('letterTune') === '1'

  const mobile = props.deviceProfile === 'mobile'
  const activeProfile: DeviceProfile = mobile ? 'mobile' : 'desktop'
  const tune = tuneProfiles[activeProfile]
  const copy = COPY[language]
  const titleLength = copy.title.length
  const totalTypingLength = titleLength + copy.body.length
  const visibleTitle = copy.title.slice(0, Math.min(typedChars, titleLength))
  const visibleBody = copy.body.slice(0, Math.max(0, typedChars - titleLength))
  const typingTitle = typedChars > 0 && typedChars < titleLength
  const typingBody = typedChars >= titleLength && typedChars < totalTypingLength
  const typingDone = typedChars >= totalTypingLength

  const previewY = previewMode === 'start'
    ? tune.startY
    : previewMode === 'end'
      ? tune.endY
      : paperRaised
        ? tune.endY
        : tune.startY

  const updateTune = (key: keyof LetterTune, value: number) => {
    if (!Number.isFinite(value)) return
    setTuneProfiles((current) => ({
      ...current,
      [activeProfile]: { ...current[activeProfile], [key]: value },
    }))
    setDirty(true)

    if (key === 'startY') {
      setPreviewMode('start')
      setPaperRaised(false)
      setTypedChars(0)
    } else if (key === 'endY') {
      setPreviewMode('end')
      setPaperRaised(true)
      setTypedChars(totalTypingLength)
    }
  }

  const previewStart = () => {
    setPreviewMode('start')
    setPaperRaised(false)
    setTypedChars(0)
  }

  const previewEnd = () => {
    setPreviewMode('end')
    setPaperRaised(true)
    setTypedChars(totalTypingLength)
  }

  const replay = () => {
    setLanguage(readLanguage())
    setPreviewMode('play')
    setTypedChars(0)
    setPaperRaised(false)
    setPlayKey((value) => value + 1)
    setOpen(true)
  }

  const openLetter = () => replay()

  const switchTuneProfile = (profile: DeviceProfile) => {
    props.onDeviceChange(profile)
    setPreviewMode('end')
    setPaperRaised(true)
    setTypedChars(totalTypingLength)
    setCopyStatus(profile === 'mobile' ? '已切到手机端参数' : '已切到电脑端参数')
    window.setTimeout(() => setCopyStatus(''), 1200)
  }

  const saveTune = () => {
    try {
      window.localStorage.setItem(LETTER_TUNE_STORAGE_KEY, JSON.stringify(tuneProfiles))
      setDirty(false)
      setCopyStatus('已保存')
    } catch {
      setCopyStatus('保存失败')
    }
    window.setTimeout(() => setCopyStatus(''), 1600)
  }

  const restoreSavedTune = () => {
    setTuneProfiles(readTuneProfiles())
    setDirty(false)
    setPreviewMode('end')
    setPaperRaised(true)
    setTypedChars(totalTypingLength)
    setCopyStatus('已恢复上次保存')
    window.setTimeout(() => setCopyStatus(''), 1600)
  }

  useEffect(() => {
    if (!letterTuneMode) return
    setLanguage(readLanguage())
    setPreviewMode('end')
    setTypedChars(totalTypingLength)
    setPaperRaised(true)
    setOpen(true)
  }, [letterTuneMode, totalTypingLength])

  useEffect(() => {
    if (tuneMode && !letterTuneMode) return

    const timer = window.setTimeout(() => {
      for (const src of [ENVELOPE_BACK_URL, ENVELOPE_PAPER_URL, ENVELOPE_FRONT_URL]) {
        const image = new Image()
        image.decoding = 'async'
        image.src = src
      }
    }, 220)

    return () => window.clearTimeout(timer)
  }, [tuneMode, letterTuneMode])

  useEffect(() => {
    if (!open || previewMode !== 'play') return
    setPaperRaised(false)
    const timer = window.setTimeout(() => setPaperRaised(true), PAPER_START_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [open, playKey, previewMode])

  useEffect(() => {
    if (!open || previewMode !== 'play') return

    setTypedChars(0)
    let timeoutId = 0
    let current = 0
    const delay = language === 'zh' ? tune.typeDelayZh : tune.typeDelayEn

    const step = () => {
      current += 1
      setTypedChars(current)
      if (current < totalTypingLength) timeoutId = window.setTimeout(step, delay)
    }

    timeoutId = window.setTimeout(
      step,
      PAPER_START_DELAY_MS + tune.riseMs + tune.typeGapMs,
    )

    return () => window.clearTimeout(timeoutId)
  }, [open, playKey, previewMode, language, totalTypingLength, tune.riseMs, tune.typeGapMs, tune.typeDelayZh, tune.typeDelayEn])

  useEffect(() => {
    if (tuneMode && !letterTuneMode) return

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
  }, [props.deviceProfile, tuneMode, letterTuneMode, open])

  const copyTune = async () => {
    const text = JSON.stringify({ profile: activeProfile, ...tune }, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('已复制')
    } catch {
      setCopyStatus('复制失败')
    }
    window.setTimeout(() => setCopyStatus(''), 1400)
  }

  const resetTune = () => {
    setTuneProfiles((current) => ({ ...current, [activeProfile]: { ...DEFAULT_TUNE[activeProfile] } }))
    setPreviewMode('end')
    setPaperRaised(true)
    setTypedChars(totalTypingLength)
    setDirty(true)
    setCopyStatus('已重置，记得保存')
    window.setTimeout(() => setCopyStatus(''), 1600)
  }

  return (
    <>
      <AtelierWithInstax {...props} />

      {open && (!tuneMode || letterTuneMode) && (
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
                ? 'min(520px, calc(100vw - 18px))'
                : 'min(820px, calc(100vw - 44px))',
              maxHeight: 'calc(100svh - 18px)',
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
              .pawcream-envelope-back { z-index: 1; }
              .pawcream-envelope-front { z-index: 4; }
              .pawcream-envelope-paper-wrap {
                position: absolute;
                z-index: 2;
                transform-origin: 50% 84%;
                will-change: transform;
              }
              .pawcream-envelope-paper {
                position: absolute;
                inset: 0;
                z-index: 1;
                width: 100%;
                height: 100%;
                object-fit: contain;
                user-select: none;
                pointer-events: none;
              }
              .pawcream-paper-copy {
                position: absolute;
                z-index: 2;
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
                font-weight: 400;
                line-height: 1.28;
                text-align: center;
              }
              .pawcream-paper-body {
                margin: 11px 0 0;
                color: #648198;
                letter-spacing: .012em;
                text-align: left;
              }
              .pawcream-paper-signature {
                margin-top: 10px;
                color: #88a2b5;
                font-family: 'PawCream EN', sans-serif;
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
              .pawcream-letter-tune-panel {
                position: fixed;
                top: 14px;
                right: 14px;
                z-index: 180;
                width: min(390px, calc(100vw - 28px));
                max-height: calc(100svh - 28px);
                overflow: auto;
                box-sizing: border-box;
                padding: 14px;
                border: 1px solid rgba(116,157,188,.34);
                border-radius: 18px;
                background: rgba(245,250,254,.95);
                box-shadow: 0 14px 42px rgba(45,75,100,.2);
                backdrop-filter: blur(12px);
                color: #496d87;
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
              }
              .pawcream-letter-tune-panel * { font-family: inherit !important; }
              .pawcream-letter-tune-panel h3 { margin: 0 0 4px; font-size: 15px; }
              .pawcream-letter-tune-panel p { margin: 0 0 10px; font-size: 11px; opacity: .72; }
              .pawcream-letter-tune-panel fieldset {
                margin: 10px 0;
                padding: 8px;
                border: 1px solid rgba(125,164,194,.22);
                border-radius: 12px;
              }
              .pawcream-letter-tune-panel legend { padding: 0 5px; font-size: 11px; font-weight: 700; }
              .pawcream-letter-tune-profile {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin: 10px 0 12px;
              }
              .pawcream-letter-tune-profile button,
              .pawcream-letter-tune-actions button {
                border: 1px solid rgba(102,149,184,.28);
                border-radius: 9px;
                background: white;
                color: #496d87;
                cursor: pointer;
              }
              .pawcream-letter-tune-profile button {
                min-height: 38px;
                font-size: 13px;
              }
              .pawcream-letter-tune-profile button.is-active {
                background: #dfeef9;
                border-color: rgba(83,137,178,.52);
                box-shadow: inset 0 0 0 1px rgba(255,255,255,.7);
              }
              .pawcream-letter-tune-row {
                display: grid;
                grid-template-columns: 92px minmax(80px, 1fr) 62px 24px;
                gap: 6px;
                align-items: center;
                margin: 5px 0;
                font-size: 10px;
              }
              .pawcream-letter-tune-row input[type='range'] { width: 100%; }
              .pawcream-letter-tune-row input[type='number'] {
                width: 62px;
                box-sizing: border-box;
                padding: 3px 4px;
                border: 1px solid rgba(111,151,181,.32);
                border-radius: 6px;
                background: white;
                color: #496d87;
                font-size: 10px;
              }
              .pawcream-letter-tune-row em { font-size: 9px; font-style: normal; opacity: .62; }
              .pawcream-letter-tune-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                position: sticky;
                bottom: -14px;
                margin: 10px -14px -14px;
                padding: 10px 14px 14px;
                background: rgba(245,250,254,.97);
              }
              .pawcream-letter-tune-actions button { padding: 6px 9px; font-size: 10px; }
              .pawcream-letter-tune-actions button.is-active {
                background: #dfeef9;
                border-color: rgba(83,137,178,.52);
              }
              .pawcream-letter-save-state {
                width: 100%;
                margin-top: 4px;
                font-size: 11px;
                font-weight: 700;
                color: ${dirty ? '#a96d54' : '#5d8a72'};
              }
              @keyframes pawcream-envelope-enter {
                from { opacity: 0; transform: translateY(8px) scale(.985); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
              @keyframes pawcream-caret-blink {
                0%, 46% { opacity: 1; }
                47%, 100% { opacity: 0; }
              }
              @media (max-height: 690px) and (min-width: 701px) {
                .pawcream-envelope-dialog { width: min(720px, calc(100vw - 44px)) !important; }
              }
              @media (max-width: 700px) {
                .pawcream-letter-tune-panel {
                  top: auto;
                  right: 8px;
                  bottom: 8px;
                  left: 8px;
                  width: auto;
                  max-height: 58svh;
                }
                .pawcream-letter-tune-row {
                  grid-template-columns: 84px minmax(70px, 1fr) 58px 22px;
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

              <div
                className="pawcream-envelope-paper-wrap"
                style={{
                  left: `${tune.paperLeft}%`,
                  top: `${tune.paperTop}%`,
                  width: `${tune.paperWidth}%`,
                  height: `${tune.paperHeight}%`,
                  transform: `translate3d(0, ${previewY}%, 0) rotate(${tune.paperRotate}deg) scale(${tune.paperScale})`,
                  transition: previewMode === 'play'
                    ? `transform ${tune.riseMs}ms cubic-bezier(.2,.76,.28,1)`
                    : 'none',
                }}
              >
                <img
                  src={ENVELOPE_PAPER_URL}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  decoding="async"
                  className="pawcream-envelope-paper"
                />

                <div
                  className="pawcream-paper-copy"
                  style={{
                    left: `${tune.textLeft}%`,
                    top: `${tune.textTop}%`,
                    width: `${tune.textWidth}%`,
                    height: `${tune.textHeight}%`,
                    fontFamily: language === 'zh'
                      ? "'PawCream CN', 'PawCream EN', sans-serif"
                      : "'PawCream EN', sans-serif",
                  }}
                >
                  <h2 className="pawcream-paper-title" style={{ fontSize: tune.titleSize }}>
                    {visibleTitle}
                    {typingTitle && <span className="pawcream-type-caret" aria-hidden="true" />}
                  </h2>

                  <p
                    className="pawcream-paper-body"
                    style={{
                      fontSize: tune.bodySize,
                      lineHeight: tune.bodyLineHeight,
                      letterSpacing: language === 'zh' ? '.015em' : '.005em',
                    }}
                  >
                    {visibleBody}
                    {typingBody && <span className="pawcream-type-caret" aria-hidden="true" />}
                  </p>

                  <div
                    className={`pawcream-paper-signature${typingDone ? ' is-visible' : ''}`}
                    style={{ fontSize: tune.signatureSize }}
                  >
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
                right: mobile ? -1 : 4,
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

          {letterTuneMode && (
            <aside className="pawcream-letter-tune-panel" onClick={(event) => event.stopPropagation()}>
              <h3>Letter Tune · {activeProfile}</h3>
              <p>Start / End 现在完全独立。修改后点击“保存参数”，Desktop / Mobile 各自保存一套。</p>

              <div className="pawcream-letter-tune-profile">
                <button
                  type="button"
                  className={activeProfile === 'desktop' ? 'is-active' : ''}
                  onClick={() => switchTuneProfile('desktop')}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  className={activeProfile === 'mobile' ? 'is-active' : ''}
                  onClick={() => switchTuneProfile('mobile')}
                >
                  Mobile
                </button>
              </div>

              <fieldset>
                <legend>Paper · 纸张</legend>
                <TuneControl label="Left" value={tune.paperLeft} min={0} max={40} step={0.5} suffix="%" onChange={(v) => updateTune('paperLeft', v)} />
                <TuneControl label="Top" value={tune.paperTop} min={-20} max={40} step={0.5} suffix="%" onChange={(v) => updateTune('paperTop', v)} />
                <TuneControl label="Width" value={tune.paperWidth} min={35} max={100} step={0.5} suffix="%" onChange={(v) => updateTune('paperWidth', v)} />
                <TuneControl label="Height" value={tune.paperHeight} min={40} max={120} step={0.5} suffix="%" onChange={(v) => updateTune('paperHeight', v)} />
                <TuneControl label="Scale" value={tune.paperScale} min={0.45} max={1.25} step={0.01} suffix="×" onChange={(v) => updateTune('paperScale', v)} />
                <TuneControl label="Rotate" value={tune.paperRotate} min={-180} max={180} step={1} suffix="deg" onChange={(v) => updateTune('paperRotate', v)} />
                <TuneControl label="Start Y" value={tune.startY} min={-100} max={140} step={1} suffix="%" onChange={(v) => updateTune('startY', v)} />
                <TuneControl label="End Y" value={tune.endY} min={-120} max={100} step={1} suffix="%" onChange={(v) => updateTune('endY', v)} />
              </fieldset>

              <fieldset>
                <legend>Text · 文字框</legend>
                <TuneControl label="Text Left" value={tune.textLeft} min={0} max={50} step={0.5} suffix="%" onChange={(v) => updateTune('textLeft', v)} />
                <TuneControl label="Text Top" value={tune.textTop} min={0} max={60} step={0.5} suffix="%" onChange={(v) => updateTune('textTop', v)} />
                <TuneControl label="Text Width" value={tune.textWidth} min={30} max={100} step={0.5} suffix="%" onChange={(v) => updateTune('textWidth', v)} />
                <TuneControl label="Text Height" value={tune.textHeight} min={20} max={90} step={0.5} suffix="%" onChange={(v) => updateTune('textHeight', v)} />
                <TuneControl label="Title Size" value={tune.titleSize} min={8} max={48} step={0.5} suffix="px" onChange={(v) => updateTune('titleSize', v)} />
                <TuneControl label="Body Size" value={tune.bodySize} min={6} max={30} step={0.5} suffix="px" onChange={(v) => updateTune('bodySize', v)} />
                <TuneControl label="Line Height" value={tune.bodyLineHeight} min={1} max={2.6} step={0.02} suffix="×" onChange={(v) => updateTune('bodyLineHeight', v)} />
                <TuneControl label="Sign Size" value={tune.signatureSize} min={5} max={24} step={0.5} suffix="px" onChange={(v) => updateTune('signatureSize', v)} />
              </fieldset>

              <fieldset>
                <legend>Animation · 动画</legend>
                <TuneControl label="Rise Time" value={tune.riseMs} min={200} max={4000} step={50} suffix="ms" onChange={(v) => updateTune('riseMs', v)} />
                <TuneControl label="Type Gap" value={tune.typeGapMs} min={0} max={1800} step={20} suffix="ms" onChange={(v) => updateTune('typeGapMs', v)} />
                <TuneControl label="中文/字" value={tune.typeDelayZh} min={10} max={180} step={2} suffix="ms" onChange={(v) => updateTune('typeDelayZh', v)} />
                <TuneControl label="EN/char" value={tune.typeDelayEn} min={8} max={120} step={2} suffix="ms" onChange={(v) => updateTune('typeDelayEn', v)} />
              </fieldset>

              <div className="pawcream-letter-tune-actions">
                <button type="button" className={previewMode === 'start' ? 'is-active' : ''} onClick={previewStart}>预览起始</button>
                <button type="button" className={previewMode === 'end' ? 'is-active' : ''} onClick={previewEnd}>预览结束</button>
                <button type="button" className={previewMode === 'play' ? 'is-active' : ''} onClick={replay}>重播动画</button>
                <button type="button" onClick={saveTune}>保存参数</button>
                <button type="button" onClick={restoreSavedTune}>恢复已保存</button>
                <button type="button" onClick={copyTune}>复制当前端</button>
                <button type="button" onClick={resetTune}>重置当前端</button>
                <div className="pawcream-letter-save-state">
                  {dirty ? '● 有未保存修改' : '✓ 当前参数已保存'}
                  {copyStatus ? ` · ${copyStatus}` : ''}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </>
  )
}
