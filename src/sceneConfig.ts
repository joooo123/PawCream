export const HOME_SOURCE = {
  width: 2048,
  height: 1535,
} as const

export const HOME_DISPLAY = {
  desktop: { width: 696, height: 514 },
  mobile: { width: 320, height: 240 },
  breakpoint: 700,
} as const

export const HOME_ANCHORS = {
  chimney: { x: 1370, y: 62 },
  houseHotspot: { x: 405, y: 48, width: 1210, height: 920 },
} as const

const BASE_URL = import.meta.env.BASE_URL

const STAR_PARTICLE_ASSET_NUMBERS = [1,2,3,4,5,6,7,8,9,10,11,12,14,15] as const

export const ASSETS = {
  home: `${BASE_URL}assets/home/Home_mobile.png`,
  homeMobile: `${BASE_URL}assets/home/Home_mobile.png`,
  ecg: `${BASE_URL}assets/effects/pawcream-ecg.png`,
  stars: STAR_PARTICLE_ASSET_NUMBERS.map((number) => `${BASE_URL}assets/stars/star-${String(number).padStart(2, '0')}.png`),
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

export const STAR_TUNING_DEFAULTS: StarTuning = {
  spawnX: 7,
  spawnY: -18,
  sizeMin: 31,
  sizeMax: 40,
  pathDurationMs: 6200,
  wobbleAmp: 9,
  wobbleFreq: 0.012,
  laneSpread: 24,
  spawnMinMs: 300,
  spawnMaxMs: 600,
  burstStars: 6,
  burstStaggerMs: 150,
  maxStars: 12,
  tracks: [
    { curveX: 59, curveY: -100, endX: 162, endY: -129, startScale: 0.85, endScale: 2.05 },
    { curveX: 71, curveY: -96, endX: 150, endY: -83, startScale: 1.1, endScale: 1.73 },
    { curveX: 28, curveY: -120, endX: 114, endY: -155, startScale: 0.76, endScale: 1.89 },
    { curveX: 69, curveY: -61, endX: 132, endY: -39, startScale: 0.91, endScale: 1.53 },
    { curveX: -8, curveY: -95, endX: 46, endY: -162, startScale: 0.91, endScale: 1.89 },
    { curveX: 3, curveY: -67, endX: 76, endY: -127, startScale: 0.78, endScale: 1.75 },
  ],
}

export const MOBILE_STAR_TUNING_DEFAULTS: StarTuning = {
  spawnX: 7,
  spawnY: -18,
  sizeMin: 20,
  sizeMax: 25,
  pathDurationMs: 6200,
  wobbleAmp: 9,
  wobbleFreq: 0.012,
  laneSpread: 24,
  spawnMinMs: 300,
  spawnMaxMs: 600,
  burstStars: 6,
  burstStaggerMs: 150,
  maxStars: 12,
  tracks: [
    { curveX: 59, curveY: -100, endX: 162, endY: -129, startScale: 0.85, endScale: 2.05 },
    { curveX: 71, curveY: -96, endX: 150, endY: -83, startScale: 1.1, endScale: 1.73 },
    { curveX: 28, curveY: -120, endX: 114, endY: -155, startScale: 0.76, endScale: 1.89 },
    { curveX: 69, curveY: -61, endX: 132, endY: -39, startScale: 0.91, endScale: 1.53 },
    { curveX: -8, curveY: -95, endX: 46, endY: -162, startScale: 0.91, endScale: 1.89 },
    { curveX: 3, curveY: -67, endX: 76, endY: -127, startScale: 0.78, endScale: 1.75 },
  ],
}
