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
  starSpawnMinMs: 2800,
  starSpawnMaxMs: 4000,
  enterDurationMs: 1280,
  mobileAutoWakeMs: 900,
} as const

export type StarTrack = {
  curveX: number
  curveY: number
  endX: number
  endY: number
}

export type StarTuning = {
  spawnX: number
  spawnY: number
  sizeMin: number
  sizeMax: number
  birthScale: number
  pathDurationMs: number
  wobbleAmp: number
  wobbleFreq: number
  laneSpread: number
  spawnMinMs: number
  spawnMaxMs: number
  burstStars: number
  maxStars: number
  tracks: StarTrack[]
}

export const MAX_STAR_TRACKS = 6

// Production defaults. ?tune=1 can override these live in the browser without
// changing the normal page. Multiple tracks share the same chimney emitter;
// each emission event can release a tunable burst of stars, distributed across
// the tracks in round-robin order.
export const STAR_TUNING_DEFAULTS: StarTuning = {
  spawnX: 22,
  spawnY: 4,
  sizeMin: 56,
  sizeMax: 72,
  birthScale: 0.38,
  pathDurationMs: 6200,
  wobbleAmp: 9,
  wobbleFreq: 0.012,
  laneSpread: 24,
  spawnMinMs: MOTION.starSpawnMinMs,
  spawnMaxMs: MOTION.starSpawnMaxMs,
  burstStars: 1,
  maxStars: 3,
  tracks: [
    {
      curveX: 72,
      curveY: -118,
      endX: 245,
      endY: -118,
    },
    {
      curveX: 126,
      curveY: -76,
      endX: 292,
      endY: -48,
    },
    {
      curveX: 54,
      curveY: -152,
      endX: 218,
      endY: -172,
    },
  ],
}
