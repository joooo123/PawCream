// XHS-only per-pixel hit testing. React assets are layered absolute images,
// not native alpha-aware hit regions. Pass through transparent overlaid art to
// the underlying lamp / sewing machine / window while keeping Color's behavior.
const ALPHA_THRESHOLD = 40
const SOFT_HIT = new Set(['light', 'sewing'])
const UNCHANGED = new Set(['bear', 'cabinet', 'note', 'pawcream'])
const fakeEvents = new WeakSet<Event>()
let canvas: HTMLCanvasElement | null = null

function isTuning() {
  return new URLSearchParams(location.search).get('tune') === '1'
}
function artworks() {
  return document.querySelector<HTMLElement>('section[aria-label^="PawCream Atelier Room"]')
}
function imageFor(control: HTMLElement) {
  return control.querySelector<HTMLImageElement>(':scope > img')
}
function isPainted(control: HTMLElement, image: HTMLImageElement, key: string, x: number, y: number) {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return false
  const width = control.offsetWidth, height = control.offsetHeight
  const rect = control.getBoundingClientRect()
  if (!width || !height) return false
  const matrix = getComputedStyle(control).transform.match(/^matrix\(([^)]+)\)$/)
  const fields = matrix ? matrix[1].split(',').map(Number) : [1, 0]
  const angle = -Math.atan2(fields[1], fields[0])
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
    const radius = key === 'light' ? 6 : key === 'sewing' ? 4 : 0
    const checks = radius
      ? [[0, 0], [-radius, 0], [radius, 0], [0, -radius], [0, radius],
        [-radius * .65, -radius * .65], [radius * .65, radius * .65],
        [-radius * .65, radius * .65], [radius * .65, -radius * .65]]
      : [[0, 0]]
    // Window/PawCream lettering and illustration are pale: every nonzero-alpha
    // pixel must count, rather than the generic alpha >= 40 threshold.
    const threshold = key === 'window' ? 1 : SOFT_HIT.has(key) ? 12 : ALPHA_THRESHOLD
    for (const [ox, oy] of checks) {
      const px = Math.max(0, Math.min(image.naturalWidth - 1,
        Math.floor((u + ox / width) * image.naturalWidth)))
      const py = Math.max(0, Math.min(image.naturalHeight - 1,
        Math.floor((v + oy / height) * image.naturalHeight)))
      ctx.clearRect(0, 0, 1, 1)
      ctx.drawImage(image, px, py, 1, 1, 0, 0, 1, 1)
      if (ctx.getImageData(0, 0, 1, 1).data[3] >= threshold) return true
    }
  } catch { return false }
  return false
}

function routeToVisibleArt(stage: HTMLElement, originalKey: string | null,
                           event: MouseEvent) {
  // Window is drawn behind other art: route to it only when the closer
  // controls did not accept the tap, and only for painted pixels.
  for (const key of ['light', 'sewing', 'window']) {
    if (key === originalKey) continue
    // A transparent lamp/sewing/color wrapper must not open the Window
    // behind it. Route Window only from the empty stage, or handle it directly
    // when Window itself is the actual DOM target.
    if (key === 'window' && originalKey !== null) continue
    const control = stage.querySelector<HTMLElement>('[data-atelier-asset="' + key + '"]')
    const image = control && imageFor(control)
    if (!control || !image || !isPainted(control, image, key, event.clientX, event.clientY)) continue
    const forwarded = new MouseEvent('click', {
      bubbles: true, cancelable: true,
      clientX: event.clientX, clientY: event.clientY, detail: 1
    })
    fakeEvents.add(forwarded)
    control.dispatchEvent(forwarded)
    return
  }
}

function intercept(event: MouseEvent | PointerEvent) {
  if (isTuning() || fakeEvents.has(event)) return
  if (event.type === 'click' && event.detail === 0 &&
      event.clientX === 0 && event.clientY === 0) return
  const target = event.target
  if (!(target instanceof Element)) return
  const stage = artworks()
  if (!stage || !stage.contains(target)) return
  const control = target.closest<HTMLElement>('[data-atelier-asset]')
  const key = control?.dataset.atelierAsset
  // Empty stage targets may still correspond to painted pixels behind an
  // element with pointer-events:none or a transparent foreground image.
  if (!control || !key) {
    if (event.type === 'click') routeToVisibleArt(stage, null, event as MouseEvent)
    return
  }
  if (UNCHANGED.has(key)) return
  const image = imageFor(control)
  if (!image || isPainted(control, image, key, event.clientX, event.clientY)) return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (event.type === 'click') routeToVisibleArt(stage, key, event as MouseEvent)
}
document.addEventListener('pointerdown', intercept, true)
document.addEventListener('click', intercept, true)
