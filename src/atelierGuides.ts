export {}

const STAGE_SELECTOR = 'section[aria-label^="PawCream Atelier Room"]'
const TOOLBAR_SELECTOR = 'nav[aria-label="PawCream Atelier toolbar"]'
const LIGHT_SELECTOR = 'img[alt="Light"]'

type GuideLanguage = 'zh' | 'en'

const FUNCTION_LABELS: Record<GuideLanguage, Record<string, string>> = {
  zh: {
    Window: '品牌介绍',
    PawCream: '品牌介绍',
    'Wall cabinet': '看看收藏',
    People: '认识朋友',
    Message: '拖动信封',
    Instax: '制作拍立得',
    'Sewing machine': '看看手作',
    Note: '打开留言板',
    Bear: '发现小熊',
    Music: '播放音乐',
    Color: '切换背景',
  },
  en: {
    Window: 'About PawCream',
    PawCream: 'About PawCream',
    'Wall cabinet': 'Explore collection',
    People: 'Meet friends',
    Message: 'Move the letter',
    Instax: 'Make an Instax',
    'Sewing machine': 'Explore handmade',
    Note: 'Open message board',
    Bear: 'Meet the bear',
    Music: 'Play music',
    Color: 'Change background',
  },
}

const isTuneMode = new URLSearchParams(window.location.search).get('tune') === '1'

if (!isTuneMode) {
  let currentStage: HTMLElement | null = null
  let introDismissed = false
  let scheduled = false

  const schedule = () => {
    if (scheduled) return
    scheduled = true
    window.requestAnimationFrame(() => {
      scheduled = false
      updateGuides()
    })
  }

  const currentLanguage = (): GuideLanguage =>
    document.documentElement.classList.contains('pawcream-lang-en') ? 'en' : 'zh'

  const currentBackgroundColor = () => {
    const background = getComputedStyle(document.documentElement)
      .getPropertyValue('--atelier-background-image')
      .toLowerCase()

    if (background.includes('background2')) return '#8669b3'
    if (background.includes('background3')) return '#d85d91'
    return '#865f45'
  }

  const toolbarIsOpen = (stage: HTMLElement) => {
    const toolbar = stage.querySelector<HTMLElement>(TOOLBAR_SELECTOR)
    if (!toolbar) return false
    return toolbar.style.pointerEvents === 'auto' || Number.parseFloat(toolbar.style.opacity || '0') > 0.5
  }

  const ensureLayers = (stage: HTMLElement) => {
    let dim = stage.querySelector<HTMLElement>(':scope > .pawcream-guide-dim')
    if (!dim) {
      dim = document.createElement('div')
      dim.className = 'pawcream-guide-dim'
      dim.setAttribute('aria-hidden', 'true')
      stage.appendChild(dim)
    }

    let labels = stage.querySelector<HTMLElement>(':scope > .pawcream-guide-label-layer')
    if (!labels) {
      labels = document.createElement('div')
      labels.className = 'pawcream-guide-label-layer'
      labels.setAttribute('aria-hidden', 'true')
      stage.appendChild(labels)
    }

    let intro = stage.querySelector<HTMLElement>(':scope > .pawcream-light-intro')
    if (!intro) {
      intro = document.createElement('div')
      intro.className = 'pawcream-light-intro'
      intro.setAttribute('aria-hidden', 'true')
      stage.appendChild(intro)
    }

    return { labels, intro }
  }

  const positionAssetLabels = (stage: HTMLElement, layer: HTMLElement) => {
    const language = currentLanguage()
    const labels = FUNCTION_LABELS[language]
    const stageRect = stage.getBoundingClientRect()
    const images = Array.from(stage.querySelectorAll<HTMLImageElement>('img[alt]'))
      .filter((image) => Boolean(labels[image.alt]))

    const seen = new Set<string>()
    const entries: Array<{ key: string; label: string; x: number; y: number }> = []

    for (const image of images) {
      const rect = image.getBoundingClientRect()
      if (!rect.width || !rect.height || seen.has(image.alt)) continue
      seen.add(image.alt)
      entries.push({
        key: image.alt,
        label: labels[image.alt],
        x: rect.left - stageRect.left + rect.width / 2,
        y: rect.top - stageRect.top + rect.height / 2,
      })
    }

    const signature = `${language}|${entries
      .map(({ key, label, x, y }) => `${key}:${label}:${x.toFixed(1)}:${y.toFixed(1)}`)
      .join('|')}`
    if (layer.dataset.signature === signature) return

    layer.dataset.signature = signature
    layer.replaceChildren(...entries.map(({ label, x, y }) => {
      const span = document.createElement('span')
      span.className = 'pawcream-guide-label'
      span.textContent = label
      span.style.left = `${x}px`
      span.style.top = `${y}px`
      return span
    }))
  }

  const hideIntro = (intro: HTMLElement) => {
    if (intro.style.display !== 'none') intro.style.display = 'none'
    if (intro.childNodes.length) intro.replaceChildren()
    delete intro.dataset.signature
  }

  const drawIntro = (stage: HTMLElement, intro: HTMLElement) => {
    if (introDismissed || toolbarIsOpen(stage)) {
      hideIntro(intro)
      return
    }

    const light = stage.querySelector<HTMLImageElement>(LIGHT_SELECTOR)
    if (!light) {
      hideIntro(intro)
      return
    }

    const stageRect = stage.getBoundingClientRect()
    const lightRect = light.getBoundingClientRect()
    if (!lightRect.width || !lightRect.height) {
      hideIntro(intro)
      return
    }

    const color = currentBackgroundColor()
    const x = Math.max(72, lightRect.left - stageRect.left - 14)
    const y = Math.min(
      stageRect.height - 34,
      Math.max(34, lightRect.top - stageRect.top + lightRect.height * 0.53),
    )
    const signature = `${x.toFixed(1)}:${y.toFixed(1)}:${color}`

    if (intro.dataset.signature === signature && intro.style.display === 'block') return
    intro.dataset.signature = signature
    intro.style.display = 'block'

    const content = document.createElement('div')
    content.className = 'pawcream-light-intro-content'
    content.style.left = `${x}px`
    content.style.top = `${y}px`
    content.style.color = color

    const label = document.createElement('span')
    label.className = 'pawcream-light-intro-label'
    label.textContent = 'click'

    const arrow = document.createElement('span')
    arrow.className = 'pawcream-light-intro-arrow'
    arrow.textContent = '→'

    content.append(label, arrow)
    intro.replaceChildren(content)
  }

  function updateGuides() {
    const stage = document.querySelector<HTMLElement>(STAGE_SELECTOR)
    if (!stage) {
      currentStage = null
      return
    }

    if (stage !== currentStage) {
      currentStage = stage
      introDismissed = false
    }

    const { labels, intro } = ensureLayers(stage)
    const active = toolbarIsOpen(stage)
    stage.classList.toggle('pawcream-guides-active', active)

    if (active) positionAssetLabels(stage, labels)
    else if (labels.childNodes.length) {
      labels.replaceChildren()
      delete labels.dataset.signature
    }

    drawIntro(stage, intro)
  }

  document.addEventListener('click', (event) => {
    const target = event.target as Element | null
    if (!target) return
    if (!target.closest('[aria-label="Light interaction"]') && !target.closest('img[alt="Light"]')) return
    introDismissed = true
    schedule()
  }, true)

  window.addEventListener('resize', schedule, { passive: true })
  window.addEventListener('scroll', schedule, { passive: true })

  const observer = new MutationObserver((records) => {
    const externalChange = records.some((record) => {
      const target = record.target instanceof Element ? record.target : record.target.parentElement
      return !target?.closest('.pawcream-guide-dim, .pawcream-guide-label-layer, .pawcream-light-intro')
    })
    if (externalChange) schedule()
  })
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'aria-label'],
  })

  schedule()
}
