const COLOR_STORAGE_KEY = 'pawcream-color-tuning-v1'
const BACKGROUND_STORAGE_KEY = 'pawcream-atelier-background-v1'

const COLOR_ASSET_VERSION = '7f85d4bc59223223e05171ccc40e4009d1f99529'
const BACKGROUND_VERSIONS = [
  '490fae2d4e560f1ab427c535f2caa0f59efd27f8',
  '952b5d1b813f6a6872b54a509847dc5ce6e96879',
  '8e09df228690d4971861a7b18d1b10a88199e12e',
]

const assetUrl = (name, version) => {
  const url = `${import.meta.env.BASE_URL}assets/atelier/${name}`
  return version ? `${url}?v=${version}` : url
}

const COLOR_ASSET_URL = assetUrl('color.png', COLOR_ASSET_VERSION)
const BACKGROUND_URLS = [
  assetUrl('background.png', BACKGROUND_VERSIONS[0]),
  assetUrl('background2.png', BACKGROUND_VERSIONS[1]),
  assetUrl('background3.png', BACKGROUND_VERSIONS[2]),
]

const COLOR_DEFAULTS = {
  desktop: { x: 88, y: 82, width: 14 },
  mobile: { x: 75, y: 88, width: 30 },
}

const cloneDefaults = () => ({
  desktop: { ...COLOR_DEFAULTS.desktop },
  mobile: { ...COLOR_DEFAULTS.mobile },
})

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const isTuneMode = () => new URLSearchParams(window.location.search).get('tune') === '1'

const getAtelierSection = () =>
  document.querySelector('section[aria-label^="PawCream Atelier Room"]')

const getProfile = (section) =>
  section.getAttribute('aria-label')?.toLowerCase().includes('mobile') ? 'mobile' : 'desktop'

const mergeProfiles = (parsed) => {
  const next = cloneDefaults()
  ;['desktop', 'mobile'].forEach((profile) => {
    const source = parsed?.[profile]
    if (!source) return
    const fallback = next[profile]
    next[profile] = {
      x: Number.isFinite(source.x) ? source.x : fallback.x,
      y: Number.isFinite(source.y) ? source.y : fallback.y,
      width: Number.isFinite(source.width) ? source.width : fallback.width,
    }
  })
  return next
}

const loadProfiles = () => {
  try {
    const raw = window.localStorage.getItem(COLOR_STORAGE_KEY)
    return raw ? mergeProfiles(JSON.parse(raw)) : cloneDefaults()
  } catch {
    return cloneDefaults()
  }
}

let colorProfiles = loadProfiles()
let colorStorageVerified = false
let dragState = null

const saveProfiles = () => {
  try {
    const serialized = JSON.stringify(colorProfiles)
    window.localStorage.setItem(COLOR_STORAGE_KEY, serialized)
    const readBack = window.localStorage.getItem(COLOR_STORAGE_KEY)
    if (!readBack) return false
    const verified = mergeProfiles(JSON.parse(readBack))
    colorStorageVerified = JSON.stringify(verified) === JSON.stringify(colorProfiles)
    return colorStorageVerified
  } catch {
    colorStorageVerified = false
    return false
  }
}

const loadBackgroundIndex = () => {
  try {
    const value = Number(window.localStorage.getItem(BACKGROUND_STORAGE_KEY))
    return Number.isInteger(value) && value >= 0 && value < BACKGROUND_URLS.length ? value : 0
  } catch {
    return 0
  }
}

let backgroundIndex = loadBackgroundIndex()

const applyBackground = () => {
  document.documentElement.style.setProperty(
    '--atelier-background-image',
    `url("${BACKGROUND_URLS[backgroundIndex]}")`,
  )
  try {
    window.localStorage.setItem(BACKGROUND_STORAGE_KEY, String(backgroundIndex))
  } catch {
    // Visual switching remains available even if localStorage is unavailable.
  }
}

const selectBackground = (index) => {
  backgroundIndex = clamp(Math.round(index), 0, BACKGROUND_URLS.length - 1)
  applyBackground()
  syncColorFeature()
}

const cycleBackground = () => {
  selectBackground((backgroundIndex + 1) % BACKGROUND_URLS.length)
}

const pointToPercent = (section, clientX, clientY) => {
  const rect = section.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  return {
    x: Number(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100).toFixed(1)),
    y: Number(clamp(((clientY - rect.top) / rect.height) * 100, 0, 100).toFixed(1)),
  }
}

const updateFromPointer = (section, clientX, clientY) => {
  const point = pointToPercent(section, clientX, clientY)
  if (!point) return
  const profile = getProfile(section)
  colorProfiles = {
    ...colorProfiles,
    [profile]: {
      ...colorProfiles[profile],
      x: point.x,
      y: point.y,
    },
  }
  saveProfiles()
  syncColorFeature()
}

const ensureColorLayer = (section, profile) => {
  let image = section.querySelector('img[data-pawcream-color="true"]')
  if (!image) {
    image = document.createElement('img')
    image.dataset.pawcreamColor = 'true'
    image.src = COLOR_ASSET_URL
    image.alt = 'Color'
    image.draggable = false
    image.decoding = 'async'
    image.setAttribute('role', 'button')
    image.setAttribute('tabindex', '0')
    image.setAttribute('aria-label', 'Change Atelier background')

    image.addEventListener('click', () => {
      if (!isTuneMode()) cycleBackground()
    })

    image.addEventListener('keydown', (event) => {
      if (isTuneMode()) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        cycleBackground()
      }
    })

    image.addEventListener('pointerdown', (event) => {
      if (!isTuneMode()) return
      dragState = { pointerId: event.pointerId }
      image.setPointerCapture(event.pointerId)
      updateFromPointer(section, event.clientX, event.clientY)
    })

    image.addEventListener('pointermove', (event) => {
      if (!isTuneMode() || dragState?.pointerId !== event.pointerId) return
      updateFromPointer(section, event.clientX, event.clientY)
    })

    const endDrag = (event) => {
      if (dragState?.pointerId !== event.pointerId) return
      dragState = null
      if (image.hasPointerCapture(event.pointerId)) image.releasePointerCapture(event.pointerId)
    }
    image.addEventListener('pointerup', endDrag)
    image.addEventListener('pointercancel', endDrag)

    section.appendChild(image)
  }

  const layout = colorProfiles[profile]
  Object.assign(image.style, {
    position: 'absolute',
    left: `${layout.x}%`,
    top: `${layout.y}%`,
    width: `${layout.width}%`,
    height: 'auto',
    transform: 'translate(-50%, -50%)',
    transformOrigin: '50% 50%',
    zIndex: '13',
    display: 'block',
    cursor: isTuneMode() ? 'grab' : 'pointer',
    touchAction: isTuneMode() ? 'none' : 'auto',
    userSelect: 'none',
    outline: isTuneMode() ? '1.5px dashed rgba(213, 111, 157, 0.9)' : 'none',
    outlineOffset: isTuneMode() ? '6px' : '0',
    borderRadius: isTuneMode() ? '10px' : '0',
  })
}

const createRange = (field, label, min, max, step) => {
  const row = document.createElement('label')
  Object.assign(row.style, {
    display: 'grid',
    gridTemplateColumns: '62px 1fr 54px',
    alignItems: 'center',
    gap: '8px',
    minHeight: '32px',
    fontSize: '11px',
  })

  const name = document.createElement('span')
  name.textContent = label

  const input = document.createElement('input')
  input.type = 'range'
  input.min = String(min)
  input.max = String(max)
  input.step = String(step)
  input.dataset.colorField = field
  input.style.width = '100%'
  input.style.accentColor = '#d58da8'

  const output = document.createElement('output')
  output.dataset.colorOutput = field
  output.style.textAlign = 'right'
  output.style.color = '#a17f8a'
  output.style.fontVariantNumeric = 'tabular-nums'

  input.addEventListener('input', () => {
    const section = getAtelierSection()
    if (!section) return
    const profile = getProfile(section)
    const value = Number(input.value)
    if (!Number.isFinite(value)) return
    colorProfiles = {
      ...colorProfiles,
      [profile]: {
        ...colorProfiles[profile],
        [field]: value,
      },
    }
    saveProfiles()
    syncColorFeature()
  })

  row.append(name, input, output)
  return row
}

const styledButton = (text) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = text
  Object.assign(button.style, {
    minHeight: '34px',
    border: '1px solid rgba(198, 133, 157, 0.24)',
    borderRadius: '11px',
    background: 'rgba(255,255,255,0.78)',
    color: '#876974',
    cursor: 'pointer',
    fontSize: '10px',
    padding: '6px 8px',
  })
  return button
}

const ensureTunePanel = (section, profile) => {
  if (!isTuneMode()) {
    document.querySelector('[data-pawcream-color-panel="true"]')?.remove()
    return
  }

  const aside = section.closest('main')?.querySelector(':scope > aside')
  const scrollArea = aside?.querySelector(':scope > div')
  if (!scrollArea) return

  let panel = scrollArea.querySelector('[data-pawcream-color-panel="true"]')
  if (!panel) {
    panel = document.createElement('section')
    panel.dataset.pawcreamColorPanel = 'true'
    Object.assign(panel.style, {
      marginTop: '16px',
      paddingTop: '13px',
      borderTop: '1px solid rgba(198, 133, 157, 0.16)',
      color: '#745f66',
      fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    })

    const title = document.createElement('strong')
    title.dataset.colorTitle = 'true'
    title.style.display = 'block'
    title.style.marginBottom = '8px'
    title.style.fontSize = '11px'
    panel.appendChild(title)

    panel.appendChild(createRange('x', 'X', 0, 100, 0.5))
    panel.appendChild(createRange('y', 'Y', 0, 100, 0.5))
    panel.appendChild(createRange('width', 'Size', 5, 120, 0.5))

    const backgroundLabel = document.createElement('strong')
    backgroundLabel.textContent = '背景预览'
    backgroundLabel.style.display = 'block'
    backgroundLabel.style.margin = '10px 0 7px'
    backgroundLabel.style.fontSize = '11px'
    panel.appendChild(backgroundLabel)

    const bgButtons = document.createElement('div')
    bgButtons.dataset.colorBackgroundButtons = 'true'
    Object.assign(bgButtons.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '6px',
    })
    ;['Background 1', 'Background 2', 'Background 3'].forEach((label, index) => {
      const button = styledButton(label)
      button.dataset.backgroundIndex = String(index)
      button.addEventListener('click', () => selectBackground(index))
      bgButtons.appendChild(button)
    })
    panel.appendChild(bgButtons)

    const actions = document.createElement('div')
    Object.assign(actions.style, {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px',
      marginTop: '12px',
    })

    const copyButton = styledButton('复制 Color 双端参数')
    copyButton.style.background = '#f8e8ee'
    copyButton.addEventListener('click', async () => {
      const text = `ATELIER_COLOR_DEFAULTS = ${JSON.stringify(colorProfiles, null, 2)}`
      try {
        await navigator.clipboard.writeText(text)
        copyButton.textContent = '已复制 Color 参数'
      } catch {
        copyButton.textContent = '复制失败'
      }
      window.setTimeout(() => {
        copyButton.textContent = '复制 Color 双端参数'
      }, 1300)
    })

    const resetButton = styledButton('恢复 Color 当前端')
    resetButton.addEventListener('click', () => {
      const currentSection = getAtelierSection()
      if (!currentSection) return
      const currentProfile = getProfile(currentSection)
      colorProfiles = {
        ...colorProfiles,
        [currentProfile]: { ...COLOR_DEFAULTS[currentProfile] },
      }
      saveProfiles()
      syncColorFeature()
    })

    actions.append(copyButton, resetButton)
    panel.appendChild(actions)

    const status = document.createElement('p')
    status.dataset.colorStorageStatus = 'true'
    Object.assign(status.style, {
      margin: '9px 0 0',
      fontSize: '10px',
      lineHeight: '1.5',
      color: '#8a6c76',
    })
    panel.appendChild(status)

    const note = document.createElement('p')
    note.textContent = '正式页点击 Color 会按 Background 1 → 2 → 3 → 1 循环切换。X / Y / Size 为电脑端、手机端独立记录。'
    Object.assign(note.style, {
      margin: '7px 0 0',
      fontSize: '10px',
      lineHeight: '1.5',
      color: '#aa8c96',
    })
    panel.appendChild(note)

    const lightPanel = scrollArea.querySelector('[data-pawcream-lightline-panel="true"]')
    if (lightPanel?.nextSibling) {
      scrollArea.insertBefore(panel, lightPanel.nextSibling)
    } else if (lightPanel) {
      scrollArea.appendChild(panel)
    } else {
      const insertBefore = scrollArea.children.item(2)
      scrollArea.insertBefore(panel, insertBefore ?? null)
    }
  }

  const title = panel.querySelector('[data-color-title="true"]')
  if (title) title.textContent = `${profile === 'desktop' ? '电脑端' : '手机端'} · Color`

  const layout = colorProfiles[profile]
  ;['x', 'y', 'width'].forEach((field) => {
    const input = panel.querySelector(`input[data-color-field="${field}"]`)
    const output = panel.querySelector(`output[data-color-output="${field}"]`)
    if (input && document.activeElement !== input) input.value = String(layout[field])
    if (output) output.textContent = `${layout[field].toFixed(1)}%`
  })

  panel.querySelectorAll('[data-background-index]').forEach((button) => {
    const active = Number(button.dataset.backgroundIndex) === backgroundIndex
    button.style.background = active ? '#f8e8ee' : 'rgba(255,255,255,0.78)'
    button.style.borderColor = active
      ? 'rgba(213, 111, 157, 0.5)'
      : 'rgba(198, 133, 157, 0.24)'
  })

  const status = panel.querySelector('[data-color-storage-status="true"]')
  if (status) {
    status.textContent = colorStorageVerified
      ? `✓ Color 参数已记录 · 当前 Background ${backgroundIndex + 1}`
      : `调节任一参数后自动记录 · 当前 Background ${backgroundIndex + 1}`
  }
}

const syncColorFeature = () => {
  applyBackground()
  const section = getAtelierSection()
  if (!section) return
  const profile = getProfile(section)
  ensureColorLayer(section, profile)
  ensureTunePanel(section, profile)
}

applyBackground()
const observer = new MutationObserver(syncColorFeature)
observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
syncColorFeature()
window.setInterval(syncColorFeature, 220)
