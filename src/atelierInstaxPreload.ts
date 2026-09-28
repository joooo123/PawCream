const BASE_URL = import.meta.env.BASE_URL

const INSTAX_FRAME_URLS = [
  `${BASE_URL}assets/instax/instax-frame-01.png?v=04c9827dc2811bad94346fc170ea03f9ac745df4`,
  `${BASE_URL}assets/instax/instax-frame-02.png?v=1438a056912d110eddf2e62423b1f1dd015f5b49`,
  `${BASE_URL}assets/instax/instax-frame-03.png?v=aa70f581698019f28a25f541aab0b1fc729b84ff`,
  `${BASE_URL}assets/instax/instax-frame-04.png?v=d9baa7ee96d0dd00662397eb90c70f793ab753f6`,
  `${BASE_URL}assets/instax/instax-frame-05.png?v=bf8dbd4f5755c12782c35f4eeb1acf74cf061299`,
  `${BASE_URL}assets/instax/instax-frame-06.png?v=010ea0ec9fbef2d8af3773094df4d66370087871`,
  `${BASE_URL}assets/instax/instax-frame-07.png?v=5be27d6331c46d0c8f0dfc946f5921b809bdf8fd`,
  `${BASE_URL}assets/instax/instax-frame-08.png?v=980d169312a17db8b6ba637c63e8ee052ffedaa9`,
] as const

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
