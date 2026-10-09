import {
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { savePawCreamPhoto, type PawCreamPhotoVisibility } from '../pawcreamPhotoStore'
import AtelierPlaceholderV2 from './AtelierPlaceholderV2'

type DeviceProfile = 'desktop' | 'mobile'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

type InstaxStep = 'select' | 'edit' | 'printing'

type ColorKey =
  | 'gray'
  | 'pink-white'
  | 'pink-blue'
  | 'purple-coffee'
  | 'green-coffee'
  | 'blue-coffee'
  | 'blue-white'
  | 'yellow-coffee'

type SizeKey = 'square' | 'double' | 'wide' | 'portrait-1' | 'portrait-2' | 'four'

type FrameMeta = {
  width: number
  height: number
  slots: FrameSlot[]
}

type FrameSlot = {
  left: number
  top: number
  width: number
  height: number
}

type PhotoPlacement = {
  url: string
  name: string
  x: number
  y: number
  zoom: number
}

type DragState = {
  index: number
  startX: number
  startY: number
  baseX: number
  baseY: number
  width: number
  height: number
} | null

const assetUrl = (folder: 'instax' | 'instax-transparent', name: string) =>
  `${import.meta.env.BASE_URL}assets/${folder}/${encodeURIComponent(name)}`

const atelierAssetUrl = (name: string) =>
  `${import.meta.env.BASE_URL}assets/atelier/${name}`

const COLOR_OPTIONS: Array<{
  key: ColorKey
  label: string
  swatch: string
  slogan: string
}> = [
  { key: 'gray', label: '灰白', swatch: '#e7e7e7', slogan: '把今天安安静静地，夹进这一页。' },
  { key: 'pink-white', label: '粉白', swatch: '#f5dce4', slogan: '路过这里，偷偷留下一颗草莓糖。' },
  { key: 'pink-blue', label: '粉蓝', swatch: 'linear-gradient(135deg,#f4d6df 0 50%,#dce7f3 50%)', slogan: '把草莓汽水和一小块晴天，藏进这一格。' },
  { key: 'purple-coffee', label: '紫咖', swatch: '#e1dff8', slogan: '夜晚打了个盹，落下一颗葡萄味的梦。' },
  { key: 'green-coffee', label: '绿咖', swatch: '#EAF5D8', slogan: '从春天口袋里，悄悄掉出一颗嫩芽糖。' },
  { key: 'blue-coffee', label: '蓝咖', swatch: '#dce7f3', slogan: '风从海边回来，捎来一小口咸咸的晚风。' },
  { key: 'blue-white', label: '蓝白', swatch: '#e9f0f6', slogan: '今天的云很软，顺便借你一小块蓝天。' },
  { key: 'yellow-coffee', label: '黄咖', swatch: '#f4e8b9', slogan: '太阳偷懒了一会儿，留下半块蜂蜜饼干。' },
]

const SIZE_OPTIONS: Array<{
  key: SizeKey
  label: string
  hint: string
}> = [
  { key: 'square', label: '方形', hint: '1 pic' },
  { key: 'double', label: '双格', hint: '2 pics' },
  { key: 'wide', label: '横向', hint: '1 pic' },
  { key: 'portrait-1', label: '竖向 1', hint: '1 pic' },
  { key: 'portrait-2', label: '竖向 2', hint: '1 pic' },
  { key: 'four', label: '四格', hint: '4 pics' },
]

const SLOT_COUNT: Record<SizeKey, number> = {
  square: 1,
  double: 2,
  wide: 1,
  'portrait-1': 1,
  'portrait-2': 1,
  four: 4,
}

const INSTAX_THEME: Record<ColorKey, {
  frosted: string
  selectedBg: string
  selectedBorder: string
  selectedText: string
  panelBg: string
  panelBorder: string
  accent: string
}> = {
  gray: {
    frosted: 'rgba(236,236,236,.48)',
    selectedBg: 'rgba(239,239,239,.92)',
    selectedBorder: 'rgba(164,164,164,.48)',
    selectedText: '#737373',
    panelBg: 'rgba(249,249,249,.76)',
    panelBorder: 'rgba(176,176,176,.22)',
    accent: '#a2a2a2',
  },
  'pink-white': {
    frosted: 'rgba(248,220,230,.44)',
    selectedBg: 'rgba(252,232,239,.94)',
    selectedBorder: 'rgba(216,147,174,.50)',
    selectedText: '#a7657e',
    panelBg: 'rgba(255,246,249,.80)',
    panelBorder: 'rgba(216,147,174,.22)',
    accent: '#d790aa',
  },
  'pink-blue': {
    frosted: 'linear-gradient(135deg, rgba(248,218,228,.46), rgba(220,233,247,.46))',
    selectedBg: 'linear-gradient(135deg, rgba(252,231,238,.96), rgba(233,241,250,.96))',
    selectedBorder: 'rgba(188,154,191,.50)',
    selectedText: '#95758f',
    panelBg: 'linear-gradient(135deg, rgba(255,247,250,.82), rgba(246,250,255,.82))',
    panelBorder: 'rgba(188,154,191,.22)',
    accent: '#c38eaa',
  },
  'purple-coffee': {
    frosted: 'rgba(225,223,248,.48)',
    selectedBg: 'rgba(238,236,252,.95)',
    selectedBorder: 'rgba(157,151,211,.50)',
    selectedText: '#7770a9',
    panelBg: 'rgba(248,247,255,.80)',
    panelBorder: 'rgba(157,151,211,.22)',
    accent: '#9d97d3',
  },
  'green-coffee': {
    frosted: 'rgba(234,245,216,.30)',
    selectedBg: 'rgba(242,249,230,.95)',
    selectedBorder: 'rgba(153,181,111,.50)',
    selectedText: '#75895d',
    panelBg: 'rgba(249,253,241,.80)',
    panelBorder: 'rgba(153,181,111,.22)',
    accent: '#9db979',
  },
  'blue-coffee': {
    frosted: 'rgba(220,231,243,.48)',
    selectedBg: 'rgba(235,243,250,.95)',
    selectedBorder: 'rgba(130,166,199,.50)',
    selectedText: '#6686a3',
    panelBg: 'rgba(247,251,255,.80)',
    panelBorder: 'rgba(130,166,199,.22)',
    accent: '#8aaeca',
  },
  'blue-white': {
    frosted: 'rgba(233,240,246,.48)',
    selectedBg: 'rgba(242,247,251,.96)',
    selectedBorder: 'rgba(157,181,201,.50)',
    selectedText: '#758a9d',
    panelBg: 'rgba(250,252,254,.82)',
    panelBorder: 'rgba(157,181,201,.22)',
    accent: '#9db5c8',
  },
  'yellow-coffee': {
    frosted: 'rgba(247,235,190,.46)',
    selectedBg: 'rgba(252,245,218,.95)',
    selectedBorder: 'rgba(199,170,93,.50)',
    selectedText: '#947b47',
    panelBg: 'rgba(255,252,241,.82)',
    panelBorder: 'rgba(199,170,93,.22)',
    accent: '#c4a75e',
  },
}

const FRAME_MAP: Record<ColorKey, Partial<Record<SizeKey, string>>> = {
  gray: {
    square: '灰白正方形.png',
    double: '灰白正方形两张.png',
    wide: '灰白横.png',
    'portrait-1': '灰白竖1.png',
    'portrait-2': '灰白竖2.png',
    four: '灰白人生四格.png',
  },
  'pink-white': {
    square: '粉白正方形.png',
    double: '粉白正方形两张.png',
    'portrait-1': '粉白竖1.png',
    'portrait-2': '粉白竖2.png',
    four: '粉白四格.png',
  },
  'pink-blue': {
    square: '粉蓝正方形.png',
    double: '粉蓝两张正方形.png',
    wide: '粉蓝横.png',
    'portrait-1': '粉蓝竖1.png',
    'portrait-2': '粉蓝竖2.png',
    four: '粉蓝四格.png',
  },
  'purple-coffee': {
    square: '紫咖正方形.png',
    double: '紫咖正方形两格.png',
    wide: '紫咖横.png',
    'portrait-1': '紫咖竖1.png',
    'portrait-2': '紫咖竖2.png',
    four: '紫咖四格.png',
  },
  'green-coffee': {
    square: '绿咖正方形.png',
    double: '绿咖正方形两格.png',
    wide: '绿咖横.png',
    'portrait-1': '绿咖竖1.png',
    'portrait-2': '绿咖竖2.png',
    four: '绿咖四格.png',
  },
  'blue-coffee': {
    square: '蓝咖正方形.png',
    double: '蓝咖两张正方形.png',
    wide: '蓝咖横.png',
    'portrait-1': '蓝咖竖1.png',
    'portrait-2': '蓝咖竖2.png',
    four: '蓝咖四格.png',
  },
  'blue-white': {
    square: '蓝白正方形.png',
    double: '蓝白正方形两格.png',
    wide: '蓝白横.png',
    'portrait-1': '蓝白竖1.png',
    'portrait-2': '蓝白竖2.png',
    four: '蓝白四格.png',
  },
  'yellow-coffee': {
    square: '黄咖正方形.png',
    double: '黄咖正方形两格.png',
    wide: '黄咖横.png',
    'portrait-1': '黄咖竖1.png',
    'portrait-2': '黄咖竖2.png',
    four: '黄咖四格.png',
  },
}

const modalButtonStyle: CSSProperties = {
  border: '1px solid rgba(187,145,162,.28)',
  background: 'rgba(255,255,255,.94)',
  color: '#8f6f7b',
  boxShadow: '0 5px 18px rgba(98,74,83,.08)',
  cursor: 'pointer',
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片素材读取失败'))
    image.src = src
  })
}

function overlapRatio(aLeft: number, aRight: number, bLeft: number, bRight: number) {
  const overlap = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft))
  const minWidth = Math.max(1, Math.min(aRight - aLeft, bRight - bLeft))
  return overlap / minWidth
}

async function detectTransparentSlots(src: string, expectedCount: number): Promise<FrameMeta> {
  const image = await loadImage(src)
  const width = image.naturalWidth
  const height = image.naturalHeight
  const maxScanWidth = 760
  const scale = Math.min(1, maxScanWidth / width)
  const scanWidth = Math.max(1, Math.round(width * scale))
  const scanHeight = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = scanWidth
  canvas.height = scanHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法分析相纸透明区域')
  ctx.drawImage(image, 0, 0, scanWidth, scanHeight)

  const pixels = ctx.getImageData(0, 0, scanWidth, scanHeight).data
  const minSegment = Math.max(10, Math.round(scanWidth * .08))
  const components: Array<{
    left: number
    right: number
    top: number
    bottom: number
    lastY: number
    rows: number
  }> = []

  for (let y = 0; y < scanHeight; y += 1) {
    const segments: Array<{ left: number; right: number }> = []
    let start = -1

    for (let x = 0; x <= scanWidth; x += 1) {
      const transparent = x < scanWidth && pixels[(y * scanWidth + x) * 4 + 3] <= 8
      if (transparent && start < 0) start = x
      if ((!transparent || x === scanWidth) && start >= 0) {
        const right = x
        if (right - start >= minSegment) segments.push({ left: start, right })
        start = -1
      }
    }

    for (const segment of segments) {
      let bestIndex = -1
      let bestOverlap = 0

      for (let index = 0; index < components.length; index += 1) {
        const component = components[index]
        if (component.lastY !== y - 1) continue
        const overlap = overlapRatio(segment.left, segment.right, component.left, component.right)
        if (overlap > .45 && overlap > bestOverlap) {
          bestOverlap = overlap
          bestIndex = index
        }
      }

      if (bestIndex >= 0) {
        const component = components[bestIndex]
        component.left = Math.min(component.left, segment.left)
        component.right = Math.max(component.right, segment.right)
        component.bottom = y + 1
        component.lastY = y
        component.rows += 1
      } else {
        components.push({
          left: segment.left,
          right: segment.right,
          top: y,
          bottom: y + 1,
          lastY: y,
          rows: 1,
        })
      }
    }
  }

  const minArea = scanWidth * scanHeight * .004
  const candidates = components
    .filter((component) => {
      const area = (component.right - component.left) * (component.bottom - component.top)
      return area >= minArea && component.rows >= Math.max(8, scanHeight * .03)
    })
    .map((component) => ({
      area: (component.right - component.left) * (component.bottom - component.top),
      left: component.left / scanWidth * 100,
      top: component.top / scanHeight * 100,
      width: (component.right - component.left) / scanWidth * 100,
      height: (component.bottom - component.top) / scanHeight * 100,
    }))

  if (candidates.length < expectedCount) {
    throw new Error(`相纸需要 ${expectedCount} 个照片区域，但只识别到 ${candidates.length} 个`)
  }

  // Some decorative PNGs contain additional transparent patches. The layout
  // decides the real photo count, so keep only the largest expected regions.
  const slots = candidates
    .sort((a, b) => b.area - a.area)
    .slice(0, expectedCount)
    .sort((a, b) => Math.abs(a.top - b.top) > 2 ? a.top - b.top : a.left - b.left)
    .map(({ area: _area, ...slot }) => slot)

  return { width, height, slots }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function drawPlacedPhoto(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  slot: FrameSlot,
  placement: PhotoPlacement,
  canvasWidth: number,
  canvasHeight: number,
) {
  const x = slot.left / 100 * canvasWidth
  const y = slot.top / 100 * canvasHeight
  const width = slot.width / 100 * canvasWidth
  const height = slot.height / 100 * canvasHeight

  const baseScale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const scale = baseScale * placement.zoom
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  const centerX = x + width / 2 + placement.x / 100 * width
  const centerY = y + height / 2 + placement.y / 100 * height

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, width, height)
  ctx.clip()
  ctx.drawImage(
    image,
    centerX - drawWidth / 2,
    centerY - drawHeight / 2,
    drawWidth,
    drawHeight,
  )
  ctx.restore()
}

async function composeFinishedPhoto(
  overlaySrc: string,
  frameMeta: FrameMeta,
  placements: PhotoPlacement[],
) {
  const overlay = await loadImage(overlaySrc)
  const canvas = document.createElement('canvas')
  canvas.width = frameMeta.width
  canvas.height = frameMeta.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法生成拍立得')

  for (let index = 0; index < frameMeta.slots.length; index += 1) {
    const placement = placements[index]
    if (!placement) throw new Error('还有照片没有选择')
    const photo = await loadImage(placement.url)
    drawPlacedPhoto(ctx, photo, frameMeta.slots[index], placement, frameMeta.width, frameMeta.height)
  }

  ctx.drawImage(overlay, 0, 0, frameMeta.width, frameMeta.height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('拍立得生成失败')),
      'image/png',
    )
  })
}

export default function AtelierWithInstax(props: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<InstaxStep>('select')
  const [colorKey, setColorKey] = useState<ColorKey>('pink-blue')
  const [sizeKey, setSizeKey] = useState<SizeKey>('square')
  const [frameMeta, setFrameMeta] = useState<FrameMeta | null>(null)
  const [frameError, setFrameError] = useState('')
  const [photos, setPhotos] = useState<PhotoPlacement[]>([])
  const [activeSlot, setActiveSlot] = useState(0)
  const [replaceTarget, setReplaceTarget] = useState<number | null>(null)
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null)
  const [finalUrl, setFinalUrl] = useState<string | null>(null)
  const [printingDone, setPrintingDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dragRef = useRef<DragState>(null)

  const tuneMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tune') === '1',
    [],
  )

  const mobile = props.deviceProfile === 'mobile'
  const frameName = FRAME_MAP[colorKey][sizeKey] ?? ''
  const opaqueFrameSrc = frameName ? assetUrl('instax', frameName) : ''
  const transparentFrameSrc = frameName ? assetUrl('instax-transparent', frameName) : ''
  const machineSrc = atelierAssetUrl('instax.png')
  const theme = INSTAX_THEME[colorKey]
  const colorOption = COLOR_OPTIONS.find((option) => option.key === colorKey) ?? COLOR_OPTIONS[0]

  const cleanupPhotos = () => {
    setPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.url))
      return []
    })
    setActiveSlot(0)
    setReplaceTarget(null)
  }

  const cleanupFinal = () => {
    setFinalUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setFinalBlob(null)
  }

  const resetSession = () => {
    cleanupPhotos()
    cleanupFinal()
    setStep('select')
    setPrintingDone(false)
    setBusy(false)
    setStatus('')
  }

  const closeInstax = () => {
    setOpen(false)
    resetSession()
  }

  const openInstax = () => {
    resetSession()
    setOpen(true)
  }

  useEffect(() => {
    if (!frameName) {
      setFrameMeta(null)
      setFrameError('这个颜色暂时没有该尺寸')
      return
    }

    let cancelled = false
    setFrameMeta(null)
    setFrameError('')

    void detectTransparentSlots(transparentFrameSrc, SLOT_COUNT[sizeKey])
      .then((meta) => {
        if (!cancelled) setFrameMeta(meta)
      })
      .catch((error) => {
        if (!cancelled) setFrameError(error instanceof Error ? error.message : '相纸读取失败')
      })

    return () => {
      cancelled = true
    }
  }, [frameName, transparentFrameSrc, sizeKey])

  useEffect(() => {
    if (tuneMode) return

    const image = document.querySelector<HTMLImageElement>(
      'section[aria-label^="PawCream Atelier Room"] img[alt="Instax"]',
    )
    const control = image?.parentElement
    if (!control) return

    const oldRole = control.getAttribute('role')
    const oldTabIndex = control.getAttribute('tabindex')
    const oldLabel = control.getAttribute('aria-label')
    const oldCursor = control.style.cursor

    control.setAttribute('role', 'button')
    control.setAttribute('tabindex', '0')
    control.setAttribute('aria-label', 'Instax interaction')
    control.style.cursor = 'pointer'

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('[aria-label="Instax interaction"]')) return
      openInstax()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const target = event.target as Element | null
      if (!target?.closest('[aria-label="Instax interaction"]')) return
      event.preventDefault()
      openInstax()
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
  }, [props.deviceProfile, tuneMode])

  useEffect(() => {
    if (step !== 'printing' || !finalUrl) return
    setPrintingDone(false)
    const timer = window.setTimeout(() => setPrintingDone(true), 1750)
    return () => window.clearTimeout(timer)
  }, [step, finalUrl])

  const selectColor = (nextColor: ColorKey) => {
    cleanupPhotos()
    cleanupFinal()
    setStatus('')
    setColorKey(nextColor)
    if (!FRAME_MAP[nextColor][sizeKey]) {
      const fallback = SIZE_OPTIONS.find((option) => FRAME_MAP[nextColor][option.key])
      if (fallback) setSizeKey(fallback.key)
    }
  }

  const selectSize = (nextSize: SizeKey) => {
    if (!FRAME_MAP[colorKey][nextSize]) return
    cleanupPhotos()
    cleanupFinal()
    setStatus('')
    setSizeKey(nextSize)
  }

  const startPhotoPicking = () => {
    if (!frameMeta || !frameName) return
    cleanupPhotos()
    cleanupFinal()
    setStep('edit')
    setStatus('')
    window.setTimeout(() => inputRef.current?.click(), 30)
  }

  const chooseMorePhotos = () => {
    setReplaceTarget(null)
    inputRef.current?.click()
  }

  const replaceActivePhoto = () => {
    setReplaceTarget(activeSlot)
    inputRef.current?.click()
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (!files.length || !frameMeta) return

    if (replaceTarget !== null) {
      const file = files[0]
      const url = URL.createObjectURL(file)
      setPhotos((current) => {
        const next = [...current]
        if (next[replaceTarget]) URL.revokeObjectURL(next[replaceTarget].url)
        next[replaceTarget] = { url, name: file.name, x: 0, y: 0, zoom: 1.12 }
        return next
      })
      setReplaceTarget(null)
      return
    }

    setPhotos((current) => {
      const next = [...current]
      const remaining = Math.max(0, frameMeta.slots.length - next.length)

      files.slice(0, remaining).forEach((file) => {
        next.push({
          url: URL.createObjectURL(file),
          name: file.name,
          x: 0,
          y: 0,
          zoom: 1.12,
        })
      })
      return next
    })
  }

  const updatePlacement = (index: number, patch: Partial<PhotoPlacement>) => {
    setPhotos((current) => current.map((photo, photoIndex) =>
      photoIndex === index ? { ...photo, ...patch } : photo))
  }

  const onSlotPointerDown = (index: number, event: ReactPointerEvent<HTMLDivElement>) => {
    const placement = photos[index]
    if (!placement) return
    const rect = event.currentTarget.getBoundingClientRect()
    setActiveSlot(index)
    dragRef.current = {
      index,
      startX: event.clientX,
      startY: event.clientY,
      baseX: placement.x,
      baseY: placement.y,
      width: rect.width,
      height: rect.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onSlotPointerMove = (index: number, event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.index !== index) return
    const placement = photos[index]
    if (!placement) return

    const limit = clamp((placement.zoom - 1) * 42 + 6, 6, 34)
    const x = clamp(drag.baseX + (event.clientX - drag.startX) / drag.width * 100, -limit, limit)
    const y = clamp(drag.baseY + (event.clientY - drag.startY) / drag.height * 100, -limit, limit)
    updatePlacement(index, { x, y })
  }

  const onSlotPointerUp = () => {
    dragRef.current = null
  }

  const finishEditing = async () => {
    if (!frameMeta || !frameName || photos.length < frameMeta.slots.length || busy) return
    setBusy(true)
    setStatus('正在显影…')

    try {
      const blob = await composeFinishedPhoto(transparentFrameSrc, frameMeta, photos)
      cleanupFinal()
      const url = URL.createObjectURL(blob)
      setFinalBlob(blob)
      setFinalUrl(url)
      setStatus('')
      setStep('printing')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '拍立得生成失败')
    } finally {
      setBusy(false)
    }
  }

  const saveFinishedPhoto = async (visibility: PawCreamPhotoVisibility) => {
    if (!finalBlob || busy) return
    setBusy(true)
    setStatus(visibility === 'public' ? '正在放进铁盒和照片墙…' : '正在放进铁盒…')

    try {
      await savePawCreamPhoto({
        imageBlob: finalBlob,
        frameName,
        visibility,
      })
      setStatus(
        visibility === 'public'
          ? '已经放进我的铁盒，也留给照片墙了 ♡'
          : '已经只放进我的铁盒了 ♡',
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  const renderEditableComposite = () => {
    if (!frameMeta) return null

    return (
      <div
        style={{
          position: 'relative',
          width: mobile ? 'min(310px, 78vw)' : 'min(360px, 48vw)',
          aspectRatio: `${frameMeta.width} / ${frameMeta.height}`,
          margin: '0 auto',
          filter: 'drop-shadow(0 16px 28px rgba(96,70,81,.16))',
          touchAction: 'none',
        }}
      >
        {frameMeta.slots.map((slot, index) => {
          const photo = photos[index]
          const active = index === activeSlot

          return (
            <div
              key={`slot-${index}`}
              onPointerDown={(event) => onSlotPointerDown(index, event)}
              onPointerMove={(event) => onSlotPointerMove(index, event)}
              onPointerUp={onSlotPointerUp}
              onPointerCancel={onSlotPointerUp}
              onClick={() => setActiveSlot(index)}
              style={{
                position: 'absolute',
                left: `${slot.left}%`,
                top: `${slot.top}%`,
                width: `${slot.width}%`,
                height: `${slot.height}%`,
                overflow: 'hidden',
                zIndex: 1,
                background: '#f7f1f3',
                boxShadow: active ? 'inset 0 0 0 3px rgba(216,139,169,.58)' : undefined,
                cursor: photo ? 'grab' : 'pointer',
              }}
            >
              {photo ? (
                <img
                  src={photo.url}
                  alt=""
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    transform: `translate3d(${photo.x}%, ${photo.y}%, 0) scale(${photo.zoom})`,
                    transformOrigin: '50% 50%',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#b99aa5',
                    fontSize: 22,
                    background: 'rgba(252,246,248,.92)',
                  }}
                >
                  {index + 1}
                </div>
              )}
            </div>
          )
        })}

        <img
          src={transparentFrameSrc}
          alt={frameName}
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            zIndex: 3,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
      </div>
    )
  }

  return (
    <>
      <AtelierPlaceholderV2 {...props} />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={replaceTarget === null}
        onChange={onFileChange}
        style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />

      {open && !tuneMode && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 130,
            display: 'grid',
            placeItems: 'center',
            padding: mobile ? 10 : 24,
            background: theme.frosted,
            backdropFilter: 'blur(12px) saturate(108%)',
            WebkitBackdropFilter: 'blur(12px) saturate(108%)',
            transition: 'background 260ms ease',
          }}
        >
          <style>{`
            .pawcream-instax-button,
            .pawcream-instax-dot,
            .pawcream-instax-size {
              transition: transform 160ms ease, background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
            }
            .pawcream-instax-button:hover,
            .pawcream-instax-size:not(:disabled):hover {
              transform: translateY(-1px);
              border-color: rgba(194,118,148,.36) !important;
            }
            .pawcream-instax-dot:hover { transform: scale(1.12); }
            @keyframes pawcream-instax-print {
              0% { transform: translate(-50%, -58%) scale(.48); opacity: .18; }
              20% { opacity: 1; }
              72% { transform: translate(-50%, 24%) scale(.70); }
              100% { transform: translate(-50%, 58%) scale(.76); opacity: 1; }
            }
            @keyframes pawcream-instax-machine {
              0%, 100% { transform: rotate(0deg); }
              24% { transform: rotate(-.8deg); }
              48% { transform: rotate(.7deg); }
              72% { transform: rotate(-.4deg); }
            }
          `}</style>

          <section
            role="dialog"
            aria-modal="true"
            aria-label="PawCream Instax maker"
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'relative',
              width: mobile ? 'min(410px, calc(100vw - 20px))' : 'min(720px, calc(100vw - 48px))',
              maxHeight: 'calc(100svh - 20px)',
              overflow: 'auto',
              padding: mobile ? '26px 18px 22px' : '32px 34px 28px',
              border: '1px solid rgba(203,153,173,.22)',
              borderRadius: mobile ? 24 : 30,
              background: 'rgba(255,253,253,.97)',
              boxShadow: '0 30px 90px rgba(96,70,81,.2)',
              color: '#80636d',
              fontFamily: "ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
            }}
          >
            <button
              type="button"
              className="pawcream-instax-button"
              aria-label="Close"
              onClick={closeInstax}
              style={{
                ...modalButtonStyle,
                position: 'absolute',
                top: 12,
                right: 12,
                width: 34,
                height: 34,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                padding: 0,
                fontSize: 31,
                zIndex: 10,
              }}
            >
              ×
            </button>

            {step === 'select' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                  <div style={{ fontSize: mobile ? 29 : 32, fontWeight: 750, letterSpacing: '.04em' }}>
                    make your intax
                  </div>
                  <div
                    key={colorKey}
                    style={{
                      marginTop: 7,
                      minHeight: '1.6em',
                      fontSize: 20,
                      color: theme.selectedText,
                      lineHeight: 1.6,
                      transition: 'color 220ms ease',
                    }}
                  >
                    {colorOption.slogan}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: mobile ? '86px minmax(0,1fr)' : '110px minmax(0,1fr)',
                    gap: mobile ? 14 : 22,
                    alignItems: 'start',
                  }}
                >
                  <div style={{ display: 'grid', gap: 8, paddingTop: 44 }}>
                    {SIZE_OPTIONS.map((option) => {
                      const enabled = Boolean(FRAME_MAP[colorKey][option.key])
                      const selected = option.key === sizeKey
                      return (
                        <button
                          key={option.key}
                          type="button"
                          disabled={!enabled}
                          className="pawcream-instax-size"
                          onClick={() => selectSize(option.key)}
                          style={{
                            minHeight: 44,
                            padding: '6px 9px',
                            borderRadius: 14,
                            border: selected
                              ? `1px solid ${theme.selectedBorder}`
                              : `1px solid ${theme.panelBorder}`,
                            background: selected ? theme.selectedBg : 'rgba(255,255,255,.72)',
                            color: selected ? theme.selectedText : '#947985',
                            opacity: enabled ? 1 : .28,
                            cursor: enabled ? 'pointer' : 'not-allowed',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ display: 'block', fontSize: 21, fontWeight: 720 }}>{option.label}</span>
                          <span style={{ display: 'block', marginTop: 2, fontSize: 18, opacity: .72 }}>{option.hint}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: mobile ? 9 : 12,
                        minHeight: 38,
                        marginBottom: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      {COLOR_OPTIONS.map((option) => {
                        const selected = option.key === colorKey
                        return (
                          <button
                            key={option.key}
                            type="button"
                            className="pawcream-instax-dot"
                            aria-label={option.label}
                            title={option.label}
                            onClick={() => selectColor(option.key)}
                            style={{
                              width: selected ? 25 : 20,
                              height: selected ? 25 : 20,
                              padding: 0,
                              borderRadius: '50%',
                              border: selected ? '3px solid white' : '2px solid white',
                              outline: selected ? `2px solid ${theme.selectedBorder}` : '1px solid rgba(130,103,113,.14)',
                              background: option.swatch,
                              boxShadow: '0 3px 9px rgba(91,68,77,.12)',
                              cursor: 'pointer',
                            }}
                          />
                        )
                      })}
                    </div>

                    <div
                      style={{
                        minHeight: mobile ? 380 : 430,
                        display: 'grid',
                        placeItems: 'center',
                        padding: 8,
                        borderRadius: 22,
                        background: theme.panelBg,
                        border: `1px solid ${theme.panelBorder}`,
                      }}
                    >
                      {frameName ? (
                        <img
                          src={opaqueFrameSrc}
                          alt={frameName}
                          draggable={false}
                          style={{
                            maxWidth: '100%',
                            maxHeight: mobile ? '355px' : '405px',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 12px 20px rgba(92,69,78,.12))',
                            userSelect: 'none',
                          }}
                        />
                      ) : (
                        <div style={{ fontSize: 21, color: '#b08f9b' }}>这个组合暂时没有相纸</div>
                      )}
                    </div>
                  </div>
                </div>

                {frameError && (
                  <div style={{ marginTop: 10, textAlign: 'center', fontSize: 20, color: '#b27688' }}>
                    {frameError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
                  <button
                    type="button"
                    className="pawcream-instax-button"
                    disabled={!frameMeta || !frameName}
                    onClick={startPhotoPicking}
                    style={{
                      ...modalButtonStyle,
                      minWidth: 116,
                      minHeight: 42,
                      borderRadius: 999,
                      padding: '9px 26px',
                      fontSize: 24,
                      fontWeight: 750,
                      opacity: frameMeta && frameName ? 1 : .42,
                    }}
                  >
                    ok!
                  </button>
                </div>
              </>
            )}

            {step === 'edit' && frameMeta && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: mobile ? 28 : 31, fontWeight: 750 }}>
                    adjust your photos
                  </div>
                  <div style={{ marginTop: 5, fontSize: 20, color: '#b08f9b' }}>
                    拖动照片调整位置 · 点击格子切换 · 滑杆缩放
                  </div>
                </div>

                {renderEditableComposite()}

                <div
                  style={{
                    width: 'min(430px,100%)',
                    margin: '14px auto 0',
                    padding: '12px 14px',
                    borderRadius: 18,
                    background: 'rgba(252,246,248,.78)',
                    border: '1px solid rgba(195,150,168,.15)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 20, color: '#9c7c87' }}>
                      {frameMeta.slots.length > 1
                        ? `第 ${activeSlot + 1} 格 / 共 ${frameMeta.slots.length} 格`
                        : '当前照片'}
                    </div>
                    <div style={{ fontSize: 19, color: '#b3959f' }}>
                      已选择 {photos.length}/{frameMeta.slots.length}
                    </div>
                  </div>

                  {photos[activeSlot] && (
                    <input
                      type="range"
                      min="1.02"
                      max="2.4"
                      step=".02"
                      value={photos[activeSlot].zoom}
                      onChange={(event) => updatePlacement(activeSlot, {
                        zoom: Number(event.currentTarget.value),
                      })}
                      style={{ width: '100%', marginTop: 10, accentColor: theme.accent }}
                      aria-label="Photo zoom"
                    />
                  )}

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    {photos.length < frameMeta.slots.length && (
                      <button
                        type="button"
                        className="pawcream-instax-button"
                        onClick={chooseMorePhotos}
                        style={{ ...modalButtonStyle, minHeight: 36, borderRadius: 999, padding: '7px 15px', fontSize: 20 }}
                      >
                        继续选照片
                      </button>
                    )}
                    {photos[activeSlot] && (
                      <button
                        type="button"
                        className="pawcream-instax-button"
                        onClick={replaceActivePhoto}
                        style={{ ...modalButtonStyle, minHeight: 36, borderRadius: 999, padding: '7px 15px', fontSize: 20 }}
                      >
                        替换当前照片
                      </button>
                    )}
                    <button
                      type="button"
                      className="pawcream-instax-button"
                      onClick={() => {
                        cleanupPhotos()
                        setStep('select')
                        setStatus('')
                      }}
                      style={{ ...modalButtonStyle, minHeight: 36, borderRadius: 999, padding: '7px 15px', fontSize: 20 }}
                    >
                      重选相纸
                    </button>
                  </div>
                </div>

                {status && (
                  <div style={{ marginTop: 10, textAlign: 'center', fontSize: 20, color: '#a87687' }}>
                    {status}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                  <button
                    type="button"
                    className="pawcream-instax-button"
                    disabled={busy || photos.length < frameMeta.slots.length}
                    onClick={() => void finishEditing()}
                    style={{
                      ...modalButtonStyle,
                      minWidth: 128,
                      minHeight: 42,
                      borderRadius: 999,
                      padding: '9px 22px',
                      background: theme.selectedBg,
                      color: theme.selectedText,
                      fontWeight: 750,
                      opacity: busy || photos.length < frameMeta.slots.length ? .42 : 1,
                    }}
                  >
                    {busy ? '显影中…' : '完成调整 ♡'}
                  </button>
                </div>
              </>
            )}

            {step === 'printing' && finalUrl && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: mobile ? 28 : 31, fontWeight: 750 }}>
                    your instax!
                  </div>
                  <div style={{ marginTop: 4, fontSize: 20, color: '#b08f9b' }}>
                    {printingDone ? '接住它 ♡' : '正在从拍立得里慢慢出来…'}
                  </div>
                </div>

                <div
                  style={{
                    position: 'relative',
                    width: mobile ? 290 : 340,
                    height: mobile ? 360 : 410,
                    maxWidth: '100%',
                    margin: '0 auto',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={finalUrl}
                    alt="Finished Instax"
                    draggable={false}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: mobile ? 118 : 132,
                      width: mobile ? '64%' : '66%',
                      maxHeight: mobile ? 250 : 290,
                      objectFit: 'contain',
                      zIndex: 1,
                      transformOrigin: '50% 0%',
                      animation: 'pawcream-instax-print 1.7s cubic-bezier(.18,.76,.22,1) both',
                      filter: 'drop-shadow(0 15px 22px rgba(83,64,71,.17))',
                    }}
                  />
                  <img
                    src={machineSrc}
                    alt=""
                    draggable={false}
                    style={{
                      position: 'absolute',
                      zIndex: 2,
                      left: '50%',
                      top: 5,
                      width: mobile ? 230 : 270,
                      maxWidth: '84%',
                      transform: 'translateX(-50%)',
                      animation: 'pawcream-instax-machine 1.15s ease-in-out 1',
                      filter: 'drop-shadow(0 15px 24px rgba(83,64,71,.12))',
                      pointerEvents: 'none',
                    }}
                  />
                </div>

                {printingDone && (
                  <div
                    style={{
                      width: 'min(500px,100%)',
                      margin: '-6px auto 0',
                      padding: '14px',
                      borderRadius: 20,
                      background: 'rgba(252,246,248,.82)',
                      border: '1px solid rgba(195,150,168,.15)',
                    }}
                  >
                    <div style={{ marginBottom: 11, textAlign: 'center', fontSize: 21, color: '#9c7885' }}>
                      这张照片想放去哪里？
                    </div>
                    <div style={{ display: 'grid', gap: 9 }}>
                      <button
                        type="button"
                        className="pawcream-instax-button"
                        disabled={busy}
                        onClick={() => void saveFinishedPhoto('public')}
                        style={{
                          ...modalButtonStyle,
                          minHeight: 44,
                          borderRadius: 16,
                          background: theme.selectedBg,
                          color: theme.selectedText,
                          fontSize: 21,
                          fontWeight: 720,
                        }}
                      >
                        放入我的铁盒，并放入照片墙
                      </button>
                      <button
                        type="button"
                        className="pawcream-instax-button"
                        disabled={busy}
                        onClick={() => void saveFinishedPhoto('private')}
                        style={{
                          ...modalButtonStyle,
                          minHeight: 44,
                          borderRadius: 16,
                          fontSize: 21,
                          fontWeight: 650,
                        }}
                      >
                        只放入我的铁盒
                      </button>
                    </div>

                    {status && (
                      <div style={{ marginTop: 10, textAlign: 'center', fontSize: 20, color: '#a87687', lineHeight: 1.6 }}>
                        {status}
                      </div>
                    )}

                    {status.startsWith('已经') && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                        <button
                          type="button"
                          className="pawcream-instax-button"
                          onClick={closeInstax}
                          style={{ ...modalButtonStyle, minHeight: 34, borderRadius: 999, padding: '6px 18px', fontSize: 20 }}
                        >
                          完成
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  )
}
