import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './atelierBackground.css'

const atelierBackgroundUrl = `${import.meta.env.BASE_URL}assets/atelier/background.png`
document.documentElement.style.setProperty(
  '--atelier-background-image',
  `url("${atelierBackgroundUrl}")`,
)

// Public assets keep their filename on GitHub Pages, so replacing a PNG in-place
// can leave browsers/CDNs serving the previous cached bytes. Pin Note to the
// current blob version so the latest uploaded artwork is requested immediately.
const NOTE_ASSET_VERSION = '517196166abc61e4216196dc5b317b39c36d2c86'
const noteAssetUrl = `${import.meta.env.BASE_URL}assets/atelier/note.png?v=${NOTE_ASSET_VERSION}`
const absoluteNoteAssetUrl = new URL(noteAssetUrl, window.location.href).href

const LIGHTLINE_ASSET_VERSION = '8471f8d314049d1699e1d2e9ebc6b37a832a667e'
const lightlineAssetUrl = `${import.meta.env.BASE_URL}assets/atelier/lighton.png?v=${LIGHTLINE_ASSET_VERSION}`
const LIGHTLINE_STORAGE_KEY = 'pawcream-lighton-tuning-v2'

type AtelierProfile = 'desktop' | 'mobile'
type LightlineLayout = {
  x: number
  y: number
  width: number
  opacity: number
}
type LightlineProfiles = Record<AtelierProfile, LightlineLayout>

const LIGHTLINE_DEFAULTS: LightlineProfiles = {
  desktop: { x: 51.5, y: 25.5, width: 28.5, opacity: 100 },
  mobile: { x: 79.5, y: 27, width: 88, opacity: 100 },
}

const cloneLightlineDefaults = (): LightlineProfiles => ({
  desktop: { ...LIGHTLINE_DEFAULTS.desktop },
  mobile: { ...LIGHTLINE_DEFAULTS.mobile },
})

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const isTuneMode = () => new URLSearchParams(window.location.search).get('tune') === '1'

const loadLightlineProfiles = (): LightlineProfiles => {
  // Production must always use the committed defaults. Browser-local tuning is
  // only for ?tune=1 so stale debug values can never move LightOn in the live page.
  if (!isTuneMode()) return cloneLightlineDefaults()

  try {
    const raw = window.localStorage.getItem(LIGHTLINE_STORAGE_KEY)
    if (!raw) return cloneLightlineDefaults()
    const parsed = JSON.parse(raw) as Partial<Record<AtelierProfile, Partial<LightlineLayout>>>
    const next = cloneLightlineDefaults()

    ;(['desktop', 'mobile'] as AtelierProfile[]).forEach((profile) => {
      const source = parsed[profile]
      if (!source) return
      const fallback = next[profile]
      next[profile] = {
        x: typeof source.x === 'number' && Number.isFinite(source.x) ? source.x : fallback.x,
        y: typeof source.y === 'number' && Number.isFinite(source.y) ? source.y : fallback.y,
        width:
          typeof source.width === 'number' && Number.isFinite(source.width)
            ? source.width
            : fallback.width,
        opacity:
          typeof source.opacity === 'number' && Number.isFinite(source.opacity)
            ? source.opacity
            : fallback.opacity,
      }
    })

    return next
  } catch {
    return cloneLightlineDefaults()
  }
}

let lightlineProfiles = loadLightlineProfiles()

const saveLightlineProfiles = () => {
  if (!isTuneMode()) return
  window.localStorage.setItem(LIGHTLINE_STORAGE_KEY, JSON.stringify(lightlineProfiles))
}

const refreshNoteAsset = () => {
  document.querySelectorAll<HTMLImageElement>('img[alt="Note"]').forEach((image) => {
    if (image.src !== absoluteNoteAssetUrl) image.src = noteAssetUrl
  })
}

const getAtelierSection = () =>
  document.querySelector<HTMLElement>('section[aria-label^="PawCream Atelier Room"]')

const getProfile = (section: HTMLElement): AtelierProfile =>
  section.getAttribute('aria-label')?.toLowerCase().includes('mobile') ? 'mobile' : 'desktop'

const isToolbarOpen = (section: HTMLElement) => {
  const toolbar = section.querySelector<HTMLElement>('nav[aria-label="PawCream Atelier toolbar"]')
  return toolbar?.style.opacity === '1'
}

const ensureLightlineLayer = (section: HTMLElement, profile: AtelierProfile) => {
  let image = section.querySelector<HTMLImageElement>('img[data-pawcream-lightline="true"]')
  if (!image) {
    image = document.createElement('img')
    image.dataset.pawcreamLightline = 'true'
    image.alt = 'LightOn'
    image.draggable = false
    image.decoding = 'async'
    image.src = lightlineAssetUrl
    image.className = 'atelier-lightline-layer'
    section.appendChild(image)
  }

  const layout = lightlineProfiles[profile]
  image.style.left = `${layout.x}%`
  image.style.top = `${layout.y}%`
  image.style.width = `${layout.width}%`
  image.style.setProperty('--lightline-opacity', String(clamp(layout.opacity, 0, 100) / 100))
  image.classList.toggle('is-visible', isTuneMode() || isToolbarOpen(section))
}

const createRange = (
  field: keyof LightlineLayout,
  label: string,
  min: number,
  max: number,
  step: number,
  suffix: string,
) => {
  const row = document.createElement('label')
  row.className = 'lightline-tune-row'

  const name = document.createElement('span')
  name.textContent = label

  const input = document.createElement('input')
  input.type = 'range'
  input.min = String(min)
  input.max = String(max)
  input.step = String(step)
  input.dataset.lightlineField = field

  const output = document.createElement('output')
  output.dataset.lightlineOutput = field

  input.addEventListener('input', () => {
    const section = getAtelierSection()
    if (!section) return
    const profile = getProfile(section)
    const value = Number(input.value)
    if (!Number.isFinite(value)) return
    lightlineProfiles = {
      ...lightlineProfiles,
      [profile]: {
        ...lightlineProfiles[profile],
        [field]: value,
      },
    }
    saveLightlineProfiles()
    syncAtelierLightline()
  })

  row.append(name, input, output)
  row.dataset.lightlineSuffix = suffix
  return row
}

const ensureLightlineTunePanel = (section: HTMLElement, profile: AtelierProfile) => {
  if (!isTuneMode()) {
    document.querySelector('[data-pawcream-lightline-panel="true"]')?.remove()
    return
  }

  const main = section.closest('main')
  const aside = main?.querySelector<HTMLElement>(':scope > aside')
  const scrollArea = aside?.querySelector<HTMLElement>(':scope > div')
  if (!scrollArea) return

  let panel = scrollArea.querySelector<HTMLElement>('[data-pawcream-lightline-panel="true"]')
  if (!panel) {
    panel = document.createElement('section')
    panel.dataset.pawcreamLightlinePanel = 'true'
    panel.className = 'lightline-tune-panel'

    const title = document.createElement('strong')
    title.dataset.lightlineTitle = 'true'
    panel.appendChild(title)

    panel.appendChild(createRange('x', 'X', 0, 100, 0.5, '%'))
    panel.appendChild(createRange('y', 'Y', 0, 100, 0.5, '%'))
    panel.appendChild(createRange('width', 'Size', 5, 180, 0.5, '%'))
    panel.appendChild(createRange('opacity', 'Opacity', 0, 100, 1, '%'))

    const actions = document.createElement('div')
    actions.className = 'lightline-tune-actions'

    const copyButton = document.createElement('button')
    copyButton.type = 'button'
    copyButton.textContent = '复制 LightOn 双端参数'
    copyButton.addEventListener('click', async () => {
      const text = `ATELIER_LIGHTON_DEFAULTS = ${JSON.stringify(lightlineProfiles, null, 2)}`
      try {
        await navigator.clipboard.writeText(text)
        copyButton.textContent = '已复制 LightOn 参数'
        window.setTimeout(() => {
          copyButton.textContent = '复制 LightOn 双端参数'
        }, 1200)
      } catch {
        copyButton.textContent = '复制失败'
        window.setTimeout(() => {
          copyButton.textContent = '复制 LightOn 双端参数'
        }, 1400)
      }
    })

    const resetButton = document.createElement('button')
    resetButton.type = 'button'
    resetButton.textContent = '恢复 LightOn 当前端'
    resetButton.addEventListener('click', () => {
      const currentSection = getAtelierSection()
      if (!currentSection) return
      const currentProfile = getProfile(currentSection)
      lightlineProfiles = {
        ...lightlineProfiles,
        [currentProfile]: { ...LIGHTLINE_DEFAULTS[currentProfile] },
      }
      saveLightlineProfiles()
      syncAtelierLightline()
    })

    actions.append(copyButton, resetButton)
    panel.appendChild(actions)

    const note = document.createElement('p')
    note.className = 'lightline-tune-note'
    note.textContent = 'LightOn 位于全场压暗磨砂层下方；调试模式会同时显示夜景遮罩，方便直接对位。'
    panel.appendChild(note)

    const insertBefore = scrollArea.children.item(2)
    scrollArea.insertBefore(panel, insertBefore ?? null)
  }

  const title = panel.querySelector<HTMLElement>('[data-lightline-title="true"]')
  if (title) title.textContent = `${profile === 'desktop' ? '电脑端' : '手机端'} · LightOn`

  const layout = lightlineProfiles[profile]
  ;(['x', 'y', 'width', 'opacity'] as (keyof LightlineLayout)[]).forEach((field) => {
    const input = panel?.querySelector<HTMLInputElement>(`input[data-lightline-field="${field}"]`)
    const output = panel?.querySelector<HTMLOutputElement>(`output[data-lightline-output="${field}"]`)
    if (input && document.activeElement !== input) input.value = String(layout[field])
    if (output) output.textContent = `${layout[field].toFixed(field === 'opacity' ? 0 : 1)}%`
  })
}

const syncAtelierLightline = () => {
  const section = getAtelierSection()
  if (!section) return
  const profile = getProfile(section)
  const nightActive = isTuneMode() || isToolbarOpen(section)

  section.classList.toggle('atelier-night-active', nightActive)
  ensureLightlineLayer(section, profile)
  ensureLightlineTunePanel(section, profile)
}

const root = document.getElementById('root')!
const noteObserver = new MutationObserver(refreshNoteAsset)
noteObserver.observe(root, { childList: true, subtree: true })

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

refreshNoteAsset()
syncAtelierLightline()
window.setInterval(syncAtelierLightline, 180)
