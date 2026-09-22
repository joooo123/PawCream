const ALPHA_THRESHOLD = 40

let sampleCanvas: HTMLCanvasElement | null = null

function isTuneMode() {
  return new URLSearchParams(window.location.search).get('tune') === '1'
}

function getInteractiveAsset(target: EventTarget | null) {
  if (!(target instanceof Element)) return null
  const stage = target.closest<HTMLElement>('section[aria-label^="PawCream Atelier Room"]')
  if (!stage) return null

  const control = target.closest<HTMLElement>('[role="button"]')
  if (!control || !stage.contains(control)) return null

  const image =
    control instanceof HTMLImageElement
      ? control
      : control.querySelector<HTMLImageElement>(':scope > img')

  if (!image) return null

  // Only artwork controls are alpha-gated. Toolbar buttons and other UI have no image child.
  const label = control.getAttribute('aria-label') ?? ''
  const isAssetInteraction = label.endsWith(' interaction') || label === 'Change Atelier background'
  if (!isAssetInteraction) return null

  return { stage, control, image }
}

function readRotationDegrees(control: HTMLElement) {
  const transform = control.style.transform || window.getComputedStyle(control).transform
  const direct = transform.match(/rotate\(([-+]?\d*\.?\d+)deg\)/)
  if (direct) return Number(direct[1]) || 0

  const matrix = window.getComputedStyle(control).transform
  const match = matrix.match(/^matrix\(([^)]+)\)$/)
  if (!match) return 0
  const values = match[1].split(',').map(Number)
  if (values.length < 2 || values.some((value) => !Number.isFinite(value))) return 0
  return (Math.atan2(values[1], values[0]) * 180) / Math.PI
}

function isOpaqueAt(
  stage: HTMLElement,
  control: HTMLElement,
  image: HTMLImageElement,
  clientX: number,
  clientY: number,
) {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return false

  const stageRect = stage.getBoundingClientRect()
  const computed = window.getComputedStyle(control)
  const left = Number.parseFloat(computed.left)
  const top = Number.parseFloat(computed.top)
  const renderWidth = control.offsetWidth
  const renderHeight = control.offsetHeight

  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    renderWidth <= 0 ||
    renderHeight <= 0
  ) {
    return false
  }

  const centerX = stageRect.left + left
  const centerY = stageRect.top + top
  const dx = clientX - centerX
  const dy = clientY - centerY
  const angle = (-readRotationDegrees(control) * Math.PI) / 180
  const localX = dx * Math.cos(angle) - dy * Math.sin(angle)
  const localY = dx * Math.sin(angle) + dy * Math.cos(angle)
  const nx = (localX + renderWidth / 2) / renderWidth
  const ny = (localY + renderHeight / 2) / renderHeight

  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return false

  try {
    sampleCanvas ??= document.createElement('canvas')
    sampleCanvas.width = 1
    sampleCanvas.height = 1
    const context = sampleCanvas.getContext('2d', { willReadFrequently: true })
    if (!context) return false

    const sourceX = Math.min(
      image.naturalWidth - 1,
      Math.max(0, Math.floor(nx * image.naturalWidth)),
    )
    const sourceY = Math.min(
      image.naturalHeight - 1,
      Math.max(0, Math.floor(ny * image.naturalHeight)),
    )

    context.clearRect(0, 0, 1, 1)
    context.drawImage(image, sourceX, sourceY, 1, 1, 0, 0, 1, 1)
    return context.getImageData(0, 0, 1, 1).data[3] >= ALPHA_THRESHOLD
  } catch {
    return false
  }
}

function blockTransparentPointer(event: PointerEvent) {
  if (isTuneMode()) return
  const asset = getInteractiveAsset(event.target)
  if (!asset) return
  if (isOpaqueAt(asset.stage, asset.control, asset.image, event.clientX, event.clientY)) return

  // Prevent transparent padding from entering React pointer logic (notably Message drag).
  event.preventDefault()
  event.stopImmediatePropagation()
}

function blockTransparentClick(event: MouseEvent) {
  if (isTuneMode()) return
  // detail === 0 is normally a keyboard-generated click; keep keyboard accessibility intact.
  if (event.detail === 0) return

  const asset = getInteractiveAsset(event.target)
  if (!asset) return
  if (isOpaqueAt(asset.stage, asset.control, asset.image, event.clientX, event.clientY)) return

  event.preventDefault()
  event.stopImmediatePropagation()

  // Let the click fall through transparent artwork to whatever is visually underneath.
  const previousPointerEvents = asset.control.style.pointerEvents
  asset.control.style.pointerEvents = 'none'
  const underneath = document.elementFromPoint(event.clientX, event.clientY)
  if (underneath && underneath !== asset.control) {
    underneath.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: event.clientX,
        clientY: event.clientY,
        detail: 1,
      }),
    )
  }
  asset.control.style.pointerEvents = previousPointerEvents
}

document.addEventListener('pointerdown', blockTransparentPointer, true)
document.addEventListener('click', blockTransparentClick, true)
