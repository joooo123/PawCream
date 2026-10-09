const BASE_URL = import.meta.env.BASE_URL

const SPLASH_SESSION_KEY = 'pawcream-splash-seen-v2'
const BACKGROUND_STORAGE_KEY = 'pawcream-atelier-background-v1'
const MIN_SPLASH_MS = 800
const MAX_SPLASH_MS = 8000
const FADE_MS = 420

const HOME_ASSETS = [
  `${BASE_URL}assets/home/Home_mobile.png`,
  `${BASE_URL}assets/effects/pawcream-ecg.png`,
  `${BASE_URL}assets/stars/star-01.png`,
  `${BASE_URL}assets/stars/star-02.png`,
  `${BASE_URL}assets/stars/star-03.png`,
  `${BASE_URL}assets/stars/star-04.png`,
  `${BASE_URL}assets/stars/star-05.png`,
  `${BASE_URL}assets/stars/star-06.png`,
  `${BASE_URL}assets/stars/star-07.png`,
  `${BASE_URL}assets/stars/star-08.png`,
  `${BASE_URL}assets/stars/star-09.png`,
  `${BASE_URL}assets/stars/star-10.png`,
  `${BASE_URL}assets/stars/star-11.png`,
  `${BASE_URL}assets/stars/star-12.png`,
  `${BASE_URL}assets/stars/star-14.png`,
  `${BASE_URL}assets/stars/star-15.png`,
] as const

const ATELIER_BACKGROUNDS = [
  `${BASE_URL}assets/atelier/background.png?v=490fae2d4e560f1ab427c535f2caa0f59efd27f8`,
  `${BASE_URL}assets/atelier/background2.png?v=952b5d1b813f6a6872b54a509847dc5ce6e96879`,
  `${BASE_URL}assets/atelier/background3.png?v=8e09df228690d4971861a7b18d1b10a88199e12e`,
] as const

const ATELIER_FIRST_LAYER = [
  `${BASE_URL}assets/atelier/window.png`,
  `${BASE_URL}assets/atelier/pawcream.png`,
  `${BASE_URL}assets/atelier/wall-mounted%20cabinet.png`,
  `${BASE_URL}assets/atelier/people.png`,
  `${BASE_URL}assets/atelier/light.png`,
  `${BASE_URL}assets/atelier/message.png`,
  `${BASE_URL}assets/atelier/instax.png`,
  `${BASE_URL}assets/atelier/sewing%20machine.png`,
  `${BASE_URL}assets/atelier/note.png?v=517196166abc61e4216196dc5b317b39c36d2c86`,
  `${BASE_URL}assets/atelier/bear.png?v=c9b3f50b5ee19c81b5bcd761a739cb6e7b8a7ca1`,
  `${BASE_URL}assets/atelier/music.png?v=9fd6532ea84d73fd23fcc5c27376ccb66d2042e8`,
  `${BASE_URL}assets/atelier/color.png?v=7f85d4bc59223223e05171ccc40e4009d1f99529`,
] as const

const DEFERRED_ASSETS = [
  `${BASE_URL}assets/atelier/lighton.png?v=8471f8d314049d1699e1d2e9ebc6b37a832a667e`,
] as const

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function currentBackgroundIndex() {
  try {
    const value = Number(window.localStorage.getItem(BACKGROUND_STORAGE_KEY))
    return Number.isInteger(value) && value >= 0 && value < ATELIER_BACKGROUNDS.length
      ? value
      : 0
  } catch {
    return 0
  }
}

function loadImage(src: string, priority: 'high' | 'auto' | 'low' = 'auto') {
  return new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.setAttribute('fetchpriority', priority)

    let finished = false
    const finish = async () => {
      if (finished) return
      finished = true
      try {
        if (typeof image.decode === 'function') await image.decode()
      } catch {
        // The bytes are already available after load; a decode rejection must
        // not make the Splash hang on browsers with stricter decode behavior.
      }
      resolve()
    }

    image.onload = () => { void finish() }
    image.onerror = () => {
      if (finished) return
      finished = true
      reject(new Error(`Failed to preload ${src}`))
    }
    image.src = src

    if (image.complete && image.naturalWidth > 0) {
      void finish()
    }
  })
}

async function loadFont(family: string, sample: string) {
  if (!document.fonts) return
  await document.fonts.load(`18px "${family}"`, sample)
}

function splashNodes() {
  return {
    root: document.getElementById('pawcream-splash'),
    progress: document.querySelector<HTMLElement>('[data-pawcream-splash-progress]'),
    status: document.querySelector<HTMLElement>('[data-pawcream-splash-status]'),
    percent: document.querySelector<HTMLElement>('[data-pawcream-splash-percent]'),
  }
}

function setSplashProgress(completed: number, total: number, status: string) {
  const nodes = splashNodes()
  const percent = total > 0 ? Math.round((completed / total) * 100) : 100
  if (nodes.progress) nodes.progress.style.width = `${Math.min(100, Math.max(4, percent))}%`
  if (nodes.status) nodes.status.textContent = status
  if (nodes.percent) nodes.percent.textContent = `${percent}%`
}

async function runBatches(
  sources: readonly string[],
  batchSize: number,
  priority: 'high' | 'auto' | 'low',
  onSettled: () => void,
) {
  for (let index = 0; index < sources.length; index += batchSize) {
    const batch = sources.slice(index, index + batchSize)
    await Promise.allSettled(
      batch.map((src) =>
        loadImage(src, priority).finally(onSettled),
      ),
    )
  }
}

async function preloadStartupAssets() {
  const selectedBackground = ATELIER_BACKGROUNDS[currentBackgroundIndex()]
  const total = HOME_ASSETS.length + ATELIER_FIRST_LAYER.length + 1 + 2
  let completed = 0

  const markHome = () => {
    completed += 1
    setSplashProgress(completed, total, 'drawing the little house...')
  }

  const markAtelier = () => {
    completed += 1
    setSplashProgress(completed, total, 'setting up the atelier...')
  }

  setSplashProgress(0, total, 'drawing the little house...')

  await Promise.allSettled([
    loadImage(HOME_ASSETS[0], 'high').finally(markHome),
    loadImage(selectedBackground, 'high').finally(markHome),
    loadFont('PawCream CN Ready', '小小工作室').finally(markHome),
    loadFont('PawCream EN Ready', 'PawCream').finally(markHome),
  ])

  // Finish the entire Home scene before the Splash opens the door.
  await runBatches(HOME_ASSETS.slice(1), 5, 'high', markHome)

  // The first Atelier scene is deliberately loaded before entry because Home
  // is a very short interaction and users often enter immediately.
  await runBatches(ATELIER_FIRST_LAYER, 4, 'auto', markAtelier)

  setSplashProgress(total, total, 'ready ♡')
}

function warmDeferredAssets() {
  const current = currentBackgroundIndex()
  const sources = [
    ...ATELIER_BACKGROUNDS.filter((_, index) => index !== current),
    ...DEFERRED_ASSETS,
  ]

  const run = () => {
    void runBatches(sources, 2, 'low', () => undefined)
  }

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
  }

  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(run, { timeout: 1600 })
  } else {
    window.setTimeout(run, 500)
  }
}

function hideSplash(immediate = false) {
  const splash = document.getElementById('pawcream-splash')
  if (!splash) return

  if (immediate) {
    splash.remove()
    return
  }

  splash.classList.add('is-leaving')
  window.setTimeout(() => splash.remove(), FADE_MS + 40)
}

function hasSeenSplashThisSession() {
  try {
    return window.sessionStorage.getItem(SPLASH_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function rememberSplash() {
  try {
    window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1')
  } catch {
    // Storage can be unavailable in private/restricted browsing contexts.
  }
}

export async function startPawCreamStartup() {
  if (hasSeenSplashThisSession()) {
    hideSplash(true)
    void preloadStartupAssets().finally(warmDeferredAssets)
    return
  }

  const startedAt = performance.now()
  const loading = preloadStartupAssets()

  // Do not trap users forever on one damaged/slow asset. The preload continues
  // in the background after the Splash timeout, so Atelier can still warm up.
  await Promise.race([
    loading,
    delay(MAX_SPLASH_MS),
  ])

  const elapsed = performance.now() - startedAt
  if (elapsed < MIN_SPLASH_MS) {
    await delay(MIN_SPLASH_MS - elapsed)
  }

  rememberSplash()
  hideSplash(false)
  void loading.finally(warmDeferredAssets)
}
