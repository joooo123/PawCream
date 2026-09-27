export {}

const STAGE_SELECTOR = 'section[aria-label^="PawCream Atelier Room"]'
const TOOLBAR_SELECTOR = 'nav[aria-label="PawCream Atelier toolbar"]'
const LIGHT_SELECTOR = 'img[alt="Light"]'
const ASSET_ALTS = new Set([
  'Window', 'PawCream', 'Wall cabinet', 'People', 'Light', 'Message',
  'Instax', 'Sewing machine', 'Note', 'Bear', 'Music', 'Color',
])

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
    const stageRect = stage.getBoundingClientRect()
    const images = Array.from(stage.querySelectorAll<HTMLImageElement>('img[alt]'))
      .filter((image) => ASSET_ALTS.has(image.alt))
    const seen = new Set<string>()
    const entries: Array<{ label: string; x: number; y: number }> = []

    for (const image of images) {
      const rect = image.getBoundingClientRect()
      if (!rect.width || !rect.height || seen.has(image.alt)) continue
      seen.add(image.alt)
      entries.push({
        label: image.alt,
        x: rect.left - stageRect.left + rect.width / 2,
        y: rect.top - stageRect.top + rect.height / 2,
      })
    }

    const signature = entries.map(({ label, x, y }) => `${label}:${x.toFixed(1)}:${y.toFixed(1)}`).join('|')
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

    const width = stageRect.width
    const height = stageRect.height
    const targetX = lightRect.left - stageRect.left + lightRect.width * 0.52
    const targetY = lightRect.top - stageRect.top + lightRect.height * 0.60
    const lightOnRight = targetX > width * 0.64
    const labelX = lightOnRight
      ? Math.max(90, targetX - Math.min(150, width * 0.34))
      : Math.min(width - 90, targetX + Math.min(155, width * 0.25))
    const labelY = Math.min(height - 60, targetY + Math.min(120, height * 0.14))
    const startX = lightOnRight ? labelX + 28 : labelX - 28
    const startY = labelY - 18
    const control1X = lightOnRight ? startX + 22 : startX - 22
    const control1Y = startY - 54
    const control2X = lightOnRight ? targetX - 44 : targetX + 44
    const control2Y = targetY + 34
    const signature = [width, height, targetX, targetY, labelX, labelY].map((v) => v.toFixed(1)).join(':')

    if (intro.dataset.signature === signature && intro.style.display === 'block') return
    intro.dataset.signature = signature
    intro.style.display = 'block'

    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('viewBox', `0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`)

    const defs = document.createElementNS(ns, 'defs')
    const marker = document.createElementNS(ns, 'marker')
    marker.setAttribute('id', 'pawcream-guide-arrowhead')
    marker.setAttribute('markerWidth', '9')
    marker.setAttribute('markerHeight', '9')
    marker.setAttribute('refX', '7')
    marker.setAttribute('refY', '4.5')
    marker.setAttribute('orient', 'auto')
    marker.setAttribute('markerUnits', 'strokeWidth')
    const triangle = document.createElementNS(ns, 'path')
    triangle.setAttribute('d', 'M 0 0 L 8 4.5 L 0 9 z')
    triangle.setAttribute('fill', '#8a4b59')
    marker.appendChild(triangle)
    defs.appendChild(marker)
    svg.appendChild(defs)

    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', `M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${targetX} ${targetY}`)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', '#8a4b59')
    path.setAttribute('stroke-width', stageRect.width <= 600 ? '2.2' : '2.6')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('marker-end', 'url(#pawcream-guide-arrowhead)')
    svg.appendChild(path)

    const label = document.createElement('span')
    label.className = 'pawcream-light-intro-label'
    label.textContent = 'click here!'
    label.style.left = `${labelX}px`
    label.style.top = `${labelY}px`
    intro.replaceChildren(svg, label)
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
