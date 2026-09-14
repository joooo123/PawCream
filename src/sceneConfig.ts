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
  startScale: number
  endScale: number
}

export type StarTuning = {
  spawnX: number
  spawnY: number
  sizeMin: number
  sizeMax: number
  pathDurationMs: number
  wobbleAmp: number
  wobbleFreq: number
  laneSpread: number
  spawnMinMs: number
  spawnMaxMs: number
  burstStars: number
  burstStaggerMs: number
  maxStars: number
  tracks: StarTrack[]
}

export const MAX_STAR_TRACKS = 6

// Production defaults. ?tune=1 can override these live in the browser without
// changing the normal page. Multiple tracks share the same chimney emitter;
// each emission event releases a tunable burst whose stars can be staggered by
// a few milliseconds, then distributed across tracks in round-robin order.
// Each track also owns its start/end size scale.
export const STAR_TUNING_DEFAULTS: StarTuning = {
  spawnX: 14,
  spawnY: -15,
  sizeMin: 31,
  sizeMax: 40,
  pathDurationMs: 6200,
  wobbleAmp: 9,
  wobbleFreq: 0.012,
  laneSpread: 24,
  spawnMinMs: 400,
  spawnMaxMs: 1300,
  burstStars: 4,
  burstStaggerMs: 250,
  maxStars: 12,
  tracks: [
    {
      curveX: 59,
      curveY: -100,
      endX: 162,
      endY: -129,
      startScale: 0.85,
      endScale: 2.05,
    },
    {
      curveX: 71,
      curveY: -96,
      endX: 150,
      endY: -83,
      startScale: 1.1,
      endScale: 1.73,
    },
    {
      curveX: 28,
      curveY: -120,
      endX: 114,
      endY: -155,
      startScale: 0.76,
      endScale: 1.89,
    },
    {
      curveX: 108,
      curveY: -62,
      endX: 164,
      endY: -53,
      startScale: 0.91,
      endScale: 1.53,
    },
    {
      curveX: -21,
      curveY: -101,
      endX: 46,
      endY: -162,
      startScale: 0.91,
      endScale: 1.89,
    },
    {
      curveX: 3,
      curveY: -67,
      endX: 76,
      endY: -127,
      startScale: 0.78,
      endScale: 1.75,
    },
  ],
}
