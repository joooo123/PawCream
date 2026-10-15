// Run before React and the individual overlay handlers. Transparent artwork
// must not intercept a tap simply because the PNG has a large rectangular box.
const ALPHA_THRESHOLD = 40
const UNCHANGED = new Set(['bear', 'cabinet', 'note', 'window', 'pawcream'])
let canvas: HTMLCanvasElement | null = null

function isTuning() {
  return new URLSearchParams(location.search).get('tune') === '1'
}

function targetArtwork(target: EventTarget | null) {
  if (!(target instanceof Element)) return null
  const control = target.closest<HTMLElement>('[data-atelier-asset]')
  const key = control?.dataset.atelierAsset
  if (!control || !key || UNCHANGED.has(key)) return null
  if (!control.closest('section[aria-label^="PawCream Atelier Room"]')) return null
  const image = control.querySelector<HTMLImageElement>(':scope > img')
  return image ? { control, image, key } : null
}

function isPainted(control: HTMLElement, image: HTMLImageElement, key: string, x: number, y: number) {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return false
  const width = control.offsetWidth
  const height = control.offsetHeight
  const rect = control.getBoundingClientRect()
  if (!width || !height) return false
  // The browser reports the axis-aligned bounds after CSS rotation. Undo that
  // rotation around the actual rendered center, rather than using tune values.
  const transform = getComputedStyle(control).transform
  let angle = 0
  const m = transform.match(/^matrix\(([^)]+)\)$/)
  if (m) {
    const fields = m[1].split(',').map(Number)
    angle = -Math.atan2(fields[1], fields[0])
  } else {
    const match = control.style.transform.match(/rotate\(([-+\d.]+)deg\)/)
    if (match) angle = -Number(match[1]) * Math.PI / 180
  }
  const dx = x - (rect.left + rect.width / 2)
  const dy = y - (rect.top + rect.height / 2)
  const u = (dx * Math.cos(angle) - dy * Math.sin(angle) + width / 2) / width
  const v = (dx * Math.sin(angle) + dy * Math.cos(angle) + height / 2) / height
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false

  try {
    canvas ??= document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false
    const sx = Math.min(image.naturalWidth - 1, Math.floor(u * image.naturalWidth))
    const sy = Math.min(image.naturalHeight - 1, Math.floor(v * image.naturalHeight))
    // A tiny 5 CSS-pixel touch allowance helps with narrow lamp outlines.
    const allowance = key === 'light' ? 5 : 0
    const checks = allowance ? [[0,0],[-allowance,0],[allowance,0],[0,-allowance],[0,allowance]] : [[0,0]]
    for (const [ox, oy] of checks) {
      const px = Math.max(0, Math.min(image.naturalWidth - 1, sx + Math.round(ox * image.naturalWidth / width)))
      const py = Math.max(0, Math.min(image.naturalHeight - 1, sy + Math.round(oy * image.naturalHeight / height)))
      ctx.clearRect(0, 0, 1, 1)
      ctx.drawImage(image, px, py, 1, 1, 0, 0, 1, 1)
      if (ctx.getImageData(0, 0, 1, 1).data[3] >= ALPHA_THRESHOLD) return true
    }
  } catch { return false }
  return false
}

function intercept(event: MouseEvent | PointerEvent) {
  if (isTuning()) return
  // Preserve keyboard-generated clicks, but not zero-detail touch clicks
  // carrying a real on-screen coordinate (a known mobile WebView behavior).
  if (event.type === 'click' && event.detail === 0 && event.clientX === 0 && event.clientY === 0) return
  const asset = targetArtwork(event.target)
  if (!asset) return
  const painted = isPainted(asset.control, asset.image, asset.key, event.clientX, event.clientY)
  asset.control.dataset.debugAlpha = painted ? 'painted' : 'transparent'
  if (painted) return
  event.preventDefault()
  event.stopImmediatePropagation()
}
document.addEventListener('pointerdown', intercept, true)
document.addEventListener('click', intercept, true)
