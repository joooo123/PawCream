const BASE_URL = import.meta.env.BASE_URL

const INSTAX_FRAME_NAMES = [
  '灰白正方形.png',
  '粉白正方形.png',
  '粉蓝正方形.png',
  '紫咖正方形.png',
  '绿咖正方形.png',
  '蓝咖正方形.png',
  '蓝白正方形.png',
  '黄咖正方形.png',
  '黄咖正方形两格.png',
] as const

const INSTAX_FRAME_URLS = INSTAX_FRAME_NAMES.flatMap((name) => {
  const encoded = encodeURIComponent(name)
  return [
    `${BASE_URL}assets/instax/${encoded}`,
    `${BASE_URL}assets/instax-transparent/${encoded}`,
  ]
})

let preloadStarted = false
const retainedImages: HTMLImageElement[] = []

function isAtelierScene() {
  return new URLSearchParams(window.location.search).get('scene') === 'atelier'
}

function preloadInstaxFrames() {
  if (preloadStarted) return
  preloadStarted = true

  for (const src of INSTAX_FRAME_URLS) {
    const image = new Image()
    retainedImages.push(image)
    image.decoding = 'async'
    image.fetchPriority = 'high'
    image.onload = () => {
      if (typeof image.decode === 'function') void image.decode().catch(() => undefined)
    }
    image.src = src

    if (image.complete && image.naturalWidth > 0 && typeof image.decode === 'function') {
      void image.decode().catch(() => undefined)
    }
  }
}

function preloadIfAtelier() {
  if (isAtelierScene()) preloadInstaxFrames()
}

if (typeof window !== 'undefined') {
  preloadIfAtelier()

  const originalPushState = window.history.pushState
  window.history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
    const result = originalPushState.apply(this, args)
    queueMicrotask(preloadIfAtelier)
    return result
  }

  const originalReplaceState = window.history.replaceState
  window.history.replaceState = function (this: History, ...args: Parameters<History['replaceState']>) {
    const result = originalReplaceState.apply(this, args)
    queueMicrotask(preloadIfAtelier)
    return result
  }

  window.addEventListener('popstate', preloadIfAtelier)
}
