import { useEffect, useRef } from 'react'
import p5 from 'p5'
import { ASSETS, MOTION, type StarTuning } from '../sceneConfig'

export type RenderedHomeRect = {
  left: number
  top: number
  width: number
  height: number
  sourceScale: number
}

type Props = {
  awake: boolean
  entering: boolean
  transitionStartedAt: number | null
  homeRect: RenderedHomeRect | null
  chimney: { x: number; y: number } | null
  tuning: StarTuning
}

type StarParticle = {
  startX: number
  startY: number
  x: number
  y: number
  sizeMix: number
  baseAlpha: number
  angle: number
  angularVelocity: number
  imageIndex: number
  trackIndex: number
  elapsedMs: number
  durationMix: number
  laneFactor: number
  wobbleSeed: number
}

type PendingStarSpawn = {
  scheduledAt: number
  burstIndex: number
  burstCount: number
  trackIndex: number
}

const STAR_VISUAL_SCALE = [
  1.00, 0.98, 0.94, 1.00, 1.06,
  0.90, 0.92, 0.90, 0.96, 0.88,
  0.94, 0.92, 0.86, 0.88, 0.88,
] as const

function orderedPair(a: number, b: number) {
  return a <= b ? [a, b] as const : [b, a] as const
}

function smoothstep(value: number) {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}

function quadraticBezier(a: number, b: number, c: number, t: number) {
  const u = 1 - t
  return u * u * a + 2 * u * t * b + t * t * c
}

export default function P5DreamLayer({
  awake,
  entering,
  transitionStartedAt,
  homeRect,
  chimney,
  tuning,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef({
    awake,
    entering,
    transitionStartedAt,
    homeRect,
    chimney,
    tuning,
  })

  useEffect(() => {
    stateRef.current = {
      awake,
      entering,
      transitionStartedAt,
      homeRect,
      chimney,
      tuning,
    }
  }, [awake, entering, transitionStartedAt, homeRect, chimney, tuning])

  useEffect(() => {
    if (!hostRef.current) return

    let starImages: p5.Image[] = []
    let ecgImage: p5.Image | null = null
    let particles: StarParticle[] = []
    let pendingSpawns: PendingStarSpawn[] = []
    let nextStarSpawnAt = 0
    let nextTrackIndex = 0

    const sketch = (s: p5) => {
      s.preload = () => {
        starImages = ASSETS.stars.map((src) => s.loadImage(src))
        ecgImage = s.loadImage(ASSETS.ecg)
      }

      s.setup = () => {
        const canvas = s.createCanvas(window.innerWidth, window.innerHeight)
        canvas.parent(hostRef.current!)
        canvas.style('pointer-events', 'none')
        s.pixelDensity(Math.min(window.devicePixelRatio || 1, 2))
        s.imageMode(s.CENTER)
        s.clear()
        nextStarSpawnAt = s.millis() + s.random(350, 650)
      }

      const getEmitterPosition = () => {
        const state = stateRef.current
        if (!state.chimney) return null

        return {
          x: state.chimney.x + state.tuning.spawnX,
          y: state.chimney.y + state.tuning.spawnY,
        }
      }

      const spawnStar = (
        trackIndex: number,
        burstIndex = 0,
        burstCount = 1,
      ) => {
        const state = stateRef.current
        const emitter = getEmitterPosition()
        if (!emitter || !starImages.length || !state.tuning.tracks.length) return

        // All 15 source images are eligible, including star-13.png (the wreath).
        const imageIndex = Math.floor(s.random(starImages.length))

        // Keep a tiny radial separation inside one burst so staggered stars still
        // feel like a shared puff rather than repeatedly occupying one exact pixel.
        const burstRadius = burstCount > 1
          ? Math.min(10, Math.max(4, state.tuning.sizeMin * 0.12))
          : 0
        const burstAngle = burstCount > 1
          ? (Math.PI * 2 * burstIndex) / burstCount + s.random(-0.12, 0.12)
          : 0
        const startX =
          emitter.x + Math.cos(burstAngle) * burstRadius + s.random(-1.5, 1.5)
        const startY =
          emitter.y + Math.sin(burstAngle) * burstRadius + s.random(-1.5, 1.5)

        particles.push({
          startX,
          startY,
          x: startX,
          y: startY,
          sizeMix: s.random(0, 1),
          baseAlpha: s.random(225, 252),
          angle: s.random(-0.05, 0.05),
          angularVelocity: s.random(-0.0016, 0.0016),
          imageIndex,
          trackIndex,
          elapsedMs: 0,
          durationMix: s.random(0.90, 1.10),
          laneFactor: s.random(-1, 1),
          wobbleSeed: s.random(0, 1000),
        })
      }

      const queueBurst = (now: number, burstCount: number) => {
        const state = stateRef.current
        const trackCount = state.tuning.tracks.length
        if (!trackCount || burstCount <= 0) return

        const staggerMs = Math.max(0, state.tuning.burstStaggerMs)

        for (let i = 0; i < burstCount; i += 1) {
          const trackIndex = nextTrackIndex % trackCount
          nextTrackIndex += 1
          pendingSpawns.push({
            scheduledAt: now + i * staggerMs,
            burstIndex: i,
            burstCount,
            trackIndex,
          })
        }
      }

      const flushPendingSpawns = (now: number, maxStars: number) => {
        if (!pendingSpawns.length) return

        const future: PendingStarSpawn[] = []
        for (const pending of pendingSpawns) {
          if (pending.scheduledAt > now) {
            future.push(pending)
            continue
          }

          if (particles.length < maxStars) {
            spawnStar(
              pending.trackIndex,
              pending.burstIndex,
              pending.burstCount,
            )
          }
        }
        pendingSpawns = future
      }

      const canSpawnStarSpatially = () => {
        const emitter = getEmitterPosition()
        if (!emitter) return false

        const minimumDistance = Math.max(54, stateRef.current.tuning.sizeMin * 0.9)
        for (const particle of particles) {
          const dx = particle.x - emitter.x
          const dy = particle.y - emitter.y
          if (Math.hypot(dx, dy) < minimumDistance) return false
        }
        return true
      }

      const drawStars = () => {
        const state = stateRef.current
        const shouldEmit = state.awake && !state.entering
        const now = s.millis()
        const maxStars = Math.max(1, Math.round(state.tuning.maxStars))
        const requestedBurst = Math.max(1, Math.round(state.tuning.burstStars))

        if (
          shouldEmit &&
          now >= nextStarSpawnAt &&
          particles.length + pendingSpawns.length < maxStars &&
          canSpawnStarSpatially()
        ) {
          const availableSlots = Math.max(
            0,
            maxStars - particles.length - pendingSpawns.length,
          )
          const burstCount = Math.min(requestedBurst, availableSlots)

          queueBurst(now, burstCount)

          const [spawnMin, spawnMax] = orderedPair(
            state.tuning.spawnMinMs,
            state.tuning.spawnMaxMs,
          )
          nextStarSpawnAt = now + s.random(spawnMin, spawnMax)
        }

        if (!shouldEmit) {
          pendingSpawns = []
          nextStarSpawnAt = now + s.random(350, 650)
        } else {
          flushPendingSpawns(now, maxStars)
        }

        const [sizeMin, sizeMax] = orderedPair(state.tuning.sizeMin, state.tuning.sizeMax)
        const durationBase = Math.max(900, state.tuning.pathDurationMs)
        const deltaMs = Math.min(Math.max(s.deltaTime || 16.67, 0), 50)
        const tracks = state.tuning.tracks

        particles = particles.filter((particle) => {
          if (!tracks.length) return false

          particle.elapsedMs += deltaMs
          const duration = durationBase * particle.durationMix
          const rawT = particle.elapsedMs / duration
          if (rawT >= 1.02) return false

          const track = tracks[particle.trackIndex % tracks.length]
          if (!track) return false

          const t = s.constrain(rawT, 0, 1)
          const pathT = smoothstep(t)
          const controlX = particle.startX + track.curveX
          const controlY = particle.startY + track.curveY
          const endX = particle.startX + track.endX
          const endY = particle.startY + track.endY

          const baseX = quadraticBezier(particle.startX, controlX, endX, pathT)
          const baseY = quadraticBezier(particle.startY, controlY, endY, pathT)

          const flowEnvelope = Math.sin(Math.PI * t)
          const laneOffset = particle.laneFactor * state.tuning.laneSpread * flowEnvelope
          const noiseX =
            (s.noise(
              particle.wobbleSeed,
              s.frameCount * Math.max(0.001, state.tuning.wobbleFreq),
            ) - 0.5) * 2 * state.tuning.wobbleAmp * flowEnvelope
          const noiseY =
            (s.noise(
              particle.wobbleSeed + 83.7,
              s.frameCount * Math.max(0.001, state.tuning.wobbleFreq) * 0.87,
            ) - 0.5) * state.tuning.wobbleAmp * 0.72 * flowEnvelope

          particle.x = baseX + laneOffset + noiseX
          particle.y = baseY + noiseY
          particle.angle += particle.angularVelocity

          const fade = t < 0.68 ? 1 : 1 - smoothstep((t - 0.68) / 0.32)
          const baseSize = s.lerp(sizeMin, sizeMax, particle.sizeMix)
          const assetScale = STAR_VISUAL_SCALE[particle.imageIndex] ?? 0.94

          // Per-track size gradient: the star smoothly changes from the track's
          // start scale at the chimney to its end scale at the end point.
          const startScale = s.constrain(track.startScale, 0.05, 3)
          const endScale = s.constrain(track.endScale, 0.05, 3)
          const sizeScale = s.lerp(startScale, endScale, pathT)
          const visualSize = baseSize * assetScale * sizeScale

          const drawAlpha = particle.baseAlpha * fade
          const img = starImages[particle.imageIndex]

          if (img && drawAlpha > 2) {
            s.push()
            s.translate(particle.x, particle.y)
            s.rotate(particle.angle)
            s.tint(255, drawAlpha)
            s.imageMode(s.CENTER)

            const sourceRatio = img.width > 0 ? img.height / img.width : 1
            s.image(img, 0, 0, visualSize, visualSize * sourceRatio)
            s.pop()
          }

          return (
            drawAlpha > 1 &&
            particle.y > -240 &&
            particle.y < s.height + 240 &&
            particle.x > -240 &&
            particle.x < s.width + 240
          )
        })
      }

      const drawHeartbeatTransition = () => {
        const state = stateRef.current
        if (!state.entering || state.transitionStartedAt === null || !ecgImage) return

        const elapsed = performance.now() - state.transitionStartedAt
        const t = s.constrain(elapsed / MOTION.enterDurationMs, 0, 1)

        const flashPeak = Math.exp(-Math.pow((t - 0.27) / 0.16, 2))
        s.noStroke()
        s.fill(255, 237, 245, 38 * flashPeak)
        s.rect(0, 0, s.width, s.height)

        const targetWidth = Math.min(s.width * 0.9, 1280)
        const targetHeight = targetWidth * (ecgImage.height / ecgImage.width)
        const x = (s.width - targetWidth) / 2
        const y = (s.height - targetHeight) / 2

        const reveal = s.constrain(t / 0.7, 0, 1)
        const eased = 1 - Math.pow(1 - reveal, 3)
        const srcW = Math.max(1, Math.floor(ecgImage.width * eased))
        const destW = targetWidth * eased
        const fadeOut = t < 0.74 ? 1 : 1 - (t - 0.74) / 0.26

        s.push()
        s.tint(255, 255 * s.constrain(fadeOut, 0, 1))
        s.imageMode(s.CORNER)
        s.image(
          ecgImage,
          x,
          y,
          destW,
          targetHeight,
          0,
          0,
          srcW,
          ecgImage.height,
        )
        s.pop()

        if (state.homeRect) {
          const pulseT = Math.exp(-Math.pow((t - 0.34) / 0.08, 2))
          if (pulseT > 0.01) {
            const cx = state.homeRect.left + state.homeRect.width * 0.52
            const cy = state.homeRect.top + state.homeRect.height * 0.44
            s.noFill()
            s.stroke(255, 129, 172, 62 * pulseT)
            s.strokeWeight(1.2)
            s.circle(cx, cy, 82 + 72 * pulseT)
          }
        }
      }

      s.draw = () => {
        s.clear()
        drawStars()
        drawHeartbeatTransition()
      }

      s.windowResized = () => {
        s.resizeCanvas(window.innerWidth, window.innerHeight)
      }
    }

    const instance = new p5(sketch)
    return () => instance.remove()
  }, [])

  return <div ref={hostRef} className="p5-dream-layer" aria-hidden="true" />
}
