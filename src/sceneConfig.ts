export const HOME_SOURCE = {
  width: 2048,
  height: 1535,
} as const

export const HOME_DISPLAY = {
  desktop: { width: 696, height: 514 },
  mobile: { width: 320, height: 240 },
  breakpoint: 700,
} as const

// Coordinates are defined in the original 2048×1535 Home artwork.
// Only these values usually need tuning after you visually inspect the page.
export const HOME_ANCHORS = {
  chimney: { x: 1370, y: 62 },
  houseHotspot: {
    x: 405,
    y: 48,
    width: 1210,
    height: 920,
  },
} as const

const BASE_URL = import.meta.env.BASE_URL

export const ASSETS = {
  home: `${BASE_URL}assets/home/Home.png`,
  ecg: `${BASE_URL}assets/effects/pawcream-ecg.png`,
  stars: Array.from({ length: 15 }, (_, i) =>
    `${BASE_URL}assets/stars/star-${String(i + 1).padStart(2, '0')}.png`,
  ),
} as const

export const MOTION = {
  // Keep stars visibly separated instead of forming a dense plume.
  starSpawnMinMs: 2800,
  starSpawnMaxMs: 4000,
  enterDurationMs: 1280,
  mobileAutoWakeMs: 900,
} as const
