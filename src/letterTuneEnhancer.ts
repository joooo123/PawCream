const QUERY_KEY = 'letterTune'
const STORAGE_KEY = 'pawcream-letter-tune-v1'
const ROTATE_KEY = 'paperRotate'

function enabled() {
  return new URLSearchParams(window.location.search).get(QUERY_KEY) === '1'
}

function getPanel() {
  return document.querySelector<HTMLElement>('.pawcream-letter-tune-panel')
}

function getProfile(panel: HTMLElement): 'desktop' | 'mobile' {
  const title = panel.querySelector('h3')?.textContent?.toLowerCase() || ''
  return title.includes('mobile') ? 'mobile' : 'desktop'
}

function readRotate(profile: 'desktop' | 'mobile') {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    const value = Number(saved?.[profile]?.[ROTATE_KEY])
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function saveRotate(profile: 'desktop' | 'mobile', value: number) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    saved[profile] = { ...(saved[profile] || {}), [ROTATE_KEY]: value }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // Live tuning still works when storage is unavailable.
  }
}

function applyRotate(value: number) {
  const paper = document.querySelector<HTMLElement>('.pawcream-envelope-paper-wrap')
  if (!paper) return
  paper.style.rotate = `${value}deg`
}

function makeRotateRow(panel: HTMLElement) {
  const profile = getProfile(panel)
  const current = Math.max(-180, Math.min(180, readRotate(profile)))

  const row = document.createElement('label')
  row.className = 'pawcream-letter-tune-row pawcream-letter-rotate-row'
  row.dataset.profile = profile

  const label = document.createElement('span')
  label.textContent = 'Rotate'

  const range = document.createElement('input')
  range.type = 'range'
  range.min = '-180'
  range.max = '180'
  range.step = '1'
  range.value = String(current)

  const number = document.createElement('input')
  number.type = 'number'
  number.min = '-180'
  number.max = '180'
  number.step = '1'
  number.value = String(current)

  const suffix = document.createElement('em')
  suffix.textContent = 'deg'

  const setValue = (raw: string) => {
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    const clamped = Math.max(-180, Math.min(180, value))
    range.value = String(clamped)
    number.value = String(clamped)
    saveRotate(profile, clamped)
    applyRotate(clamped)
  }

  range.addEventListener('input', () => setValue(range.value))
  number.addEventListener('input', () => setValue(number.value))

  row.append(label, range, number, suffix)
  applyRotate(current)
  return row
}

function ensureRotateControl(panel: HTMLElement) {
  const profile = getProfile(panel)
  const existing = panel.querySelector<HTMLElement>('.pawcream-letter-rotate-row')
  if (existing?.dataset.profile === profile) {
    const range = existing.querySelector<HTMLInputElement>('input[type="range"]')
    const number = existing.querySelector<HTMLInputElement>('input[type="number"]')
    if (range) {
      range.min = '-180'
      range.max = '180'
      range.step = '1'
    }
    if (number) {
      number.min = '-180'
      number.max = '180'
      number.step = '1'
    }
    applyRotate(Math.max(-180, Math.min(180, readRotate(profile))))
    return
  }
  existing?.remove()

  const paperFieldset = panel.querySelector('fieldset')
  if (!paperFieldset) return
  const rows = Array.from(paperFieldset.querySelectorAll('.pawcream-letter-tune-row'))
  const scaleRow = rows.find((row) => row.querySelector('span')?.textContent?.trim() === 'Scale')
  const rotateRow = makeRotateRow(panel)
  if (scaleRow?.nextSibling) paperFieldset.insertBefore(rotateRow, scaleRow.nextSibling)
  else paperFieldset.appendChild(rotateRow)
}

function installStyle() {
  let style = document.getElementById('pawcream-letter-tune-large-style') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'pawcream-letter-tune-large-style'
    document.head.appendChild(style)
  }

  style.textContent = `
    .pawcream-letter-tune-panel {
      width: min(560px, calc(100vw - 28px)) !important;
      padding: 20px !important;
      font-size: 20px !important;
    }
    .pawcream-letter-tune-panel h3 {
      font-size: 24px !important;
      line-height: 1.3 !important;
      margin-bottom: 9px !important;
    }
    .pawcream-letter-tune-panel p {
      font-size: 19px !important;
      line-height: 1.5 !important;
      margin-bottom: 15px !important;
    }
    .pawcream-letter-tune-panel fieldset {
      padding: 13px !important;
      margin: 14px 0 !important;
    }
    .pawcream-letter-tune-panel legend {
      font-size: 19px !important;
    }
    .pawcream-letter-tune-row {
      grid-template-columns: 142px minmax(120px, 1fr) 92px 46px !important;
      gap: 9px !important;
      margin: 9px 0 !important;
      font-size: 19px !important;
      line-height: 1.25 !important;
    }
    .pawcream-letter-tune-row input[type='number'] {
      width: 92px !important;
      min-height: 40px !important;
      padding: 6px 7px !important;
      font-size: 19px !important;
    }
    .pawcream-letter-tune-row em {
      font-size: 17px !important;
    }
    .pawcream-letter-tune-actions {
      gap: 9px !important;
      padding-top: 14px !important;
    }
    .pawcream-letter-tune-actions button {
      min-height: 42px !important;
      padding: 9px 14px !important;
      font-size: 19px !important;
    }
    .pawcream-letter-tune-actions span {
      font-size: 18px !important;
    }
    @media (max-width: 700px) {
      .pawcream-letter-tune-panel {
        max-height: 58svh !important;
        padding: 17px !important;
        font-size: 19px !important;
      }
      .pawcream-letter-tune-panel h3 { font-size: 23px !important; }
      .pawcream-letter-tune-panel p,
      .pawcream-letter-tune-panel legend { font-size: 18px !important; }
      .pawcream-letter-tune-row {
        grid-template-columns: 116px minmax(70px, 1fr) 84px 38px !important;
        gap: 7px !important;
        font-size: 18px !important;
      }
      .pawcream-letter-tune-row input[type='number'] {
        width: 84px !important;
        min-height: 38px !important;
        font-size: 18px !important;
      }
      .pawcream-letter-tune-row em { font-size: 17px !important; }
      .pawcream-letter-tune-actions button { font-size: 18px !important; }
      .pawcream-letter-tune-actions span { font-size: 18px !important; }
    }
  `
}

function refresh() {
  if (!enabled()) return
  installStyle()
  const panel = getPanel()
  if (!panel) return
  ensureRotateControl(panel)
}

if (enabled()) {
  refresh()
  const observer = new MutationObserver(() => refresh())
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })
  window.addEventListener('resize', refresh)
}
