import { useEffect, useRef } from 'react'
import p5 from 'p5'
import { ASSETS, MOTION } from '../sceneConfig'

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
}

type StarParticle = {
  x: number
  y: number
  vy: number
  driftSpeed: number
  travelX: number
  laneOffset: number
  baseSize: number
  alpha: number
  angle: number
  angularVelocity: number
  imageIndex: number
  age: number
  riseFrames: number
  windRampFrames: number
  wobbleSeed: number
}

const STAR_VISUAL_SCALE = [
  1.00, 0.98, 0.94, 1.00, 1.06,
  0.90, 0.92, 0.90, 0.96, 0.88,
  0.94, 0.92, 0.86, 0.88, 0.88,
] as const

// Zero-based asset indexes. 12 === star-13.png (the wreath/ring composition).
const DISABLED_STAR_INDICES = new Set<number>([12])

export default function P5DreamLayer({
  awake,
  entering,
  transitionStartedAt,
  homeRect,
  chimney,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef({ awake, entering, transitionStartedAt, homeRect, chimney })

  useEffect(() => {
    stateRef.current = { awake, entering, transitionStartedAt, homeRect, chimney }
  }, [awake, entering, transitionStartedAt, homeRect, chimney])

  useEffect(() => {
    if (!hostRef.current) return

    let starImages: p5.Image[] = []
    let ecgImage: p5.Image | null = null
    let particles: StarParticle[] = []
    let nextStarSpawnAt = 0

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

        // Sit just above the previous position: still attached to the chimney,
        // but no longer visually sunk into the roof artwork.
        const downwardOffset = s.constrain((state.homeRect?.height ?? 514) * 0.008, 3, 5)
        return {
          x: state.chimney.x + 22,
          y: state.chimney.y + downwardOffset,
        }
      }

      const getEnabledStarIndices = () => {
        const enabled: number[] = []
        for (let i = 0; i < starImages.length; i += 1) {
          if (!DISABLED_STAR_INDICES.has(i)) enabled.push(i)
        }
        return enabled
      }

      const chooseLaneOffset = () => {
        const lanes = [-30, 8, 46]

        if (particles.length === 0) {
          return lanes[Math.floor(s.random(lanes.length))] + s.random(-3, 3)
        }

        let bestLane = lanes[0]
        let bestScore = -Infinity

        for (const lane of lanes) {
          let minDiff = Infinity
          for (const particle of particles) {
            minDiff = Math.min(minDiff, Math.abs(lane - particle.laneOffset))
          }
          if (minDiff > bestScore) {
            bestScore = minDiff
            bestLane = lane
          }
        }

        return bestLane + s.random(-3, 3)
      }

      const spawnStar = () => {
        const emitter = getEmitterPosition()
        if (!emitter || !starImages.length) return

        const enabled = getEnabledStarIndices()
        if (!enabled.length) return

        const imageIndex = enabled[Math.floor(s.random(enabled.length))]

        particles.push({
          x: emitter.x + s.random(-3, 3),
          y: emitter.y + s.random(-3, 3),
          vy: s.random(-0.30, -0.22),
          driftSpeed: s.random(0.78, 0.96),
          travelX: 0,
          laneOffset: chooseLaneOffset(),
          baseSize: s.random(56, 72),
          alpha: s.random(225, 252),
          angle: s.random(-0.05, 0.05),
          angularVelocity: s.random(-0.0016, 0.0016),
          imageIndex,
          age: 0,
          riseFrames: Math.floor(s.random(4, 7)),
          windRampFrames: Math.floor(s.random(16, 24)),
          wobbleSeed: s.random(0, 1000),
        })
      }

      const canSpawnStarSpatially = () => {
        const emitter = getEmitterPosition()
        if (!emitter) return false

        const minimumDistance = 78
        for (const particle of particles) {
          const dx = particle.x - emitter.x
          const dy = particle.y - emitter.y
          if (Math.hypot(dx, dy) < minimumDistance) return false
        }
        return true
      }

      const applyPairwiseSeparation = () => {
        for (let i = 0; i < particles.length; i += 1) {
          for (let j = i + 1; j < particles.length; j += 1) {
            const a = particles[i]
            const b = particles[j]
            const dx = b.x - a.x
            const dy = b.y - a.y
            const distance = Math.hypot(dx, dy)
            const requiredDistance = 68

            if (distance >= requiredDistance) continue

            const safeDistance = Math.max(distance, 0.001)
            const overlap = requiredDistance - safeDistance
            let directionX = dx / safeDistance

            if (Math.abs(directionX) < 0.18) {
              directionX = a.laneOffset <= b.laneOffset ? 1 : -1
            }

            const pushX = Math.min(overlap * 0.08, 1.0)
            a.x -= directionX * pushX
            b.x += directionX * pushX
          }
        }
      }

      const drawStars = () => {
        const state = stateRef.current
        const shouldEmit = state.awake && !state.entering
        const now = s.millis()

        const canSpawnByCount = particles.length < 3
        const canSpawnBySpace = canSpawnStarSpatially()

        if (
          shouldEmit &&
          now >= nextStarSpawnAt &&
          canSpawnByCount &&
          canSpawnBySpace
        ) {
          spawnStar()
          nextStarSpawnAt = now + s.random(MOTION.starSpawnMinMs, MOTION.starSpawnMaxMs)
        }

        if (!shouldEmit) {
          nextStarSpawnAt = now + s.random(350, 650)
        }

        particles = particles.filter(
          (particle) =>
            particle.alpha > 4 &&
            particle.y > -180 &&
            particle.x < s.width + 180,
        )

        const emitter = getEmitterPosition()

        for (const particle of particles) {
          particle.age += 1

          const windFactor = s.constrain(
            (particle.age - particle.riseFrames) / particle.windRampFrames,
            0,
            1,
          )
          const smoothWind = windFactor * windFactor * (3 - 2 * windFactor)

          const laneEase = 0.46 + smoothWind * 0.54
          const wobble =
            (s.noise(particle.wobbleSeed, s.frameCount * 0.008) - 0.5) * 0.12

          particle.travelX += particle.driftSpeed * smoothWind

          if (emitter) {
            const targetX =
              emitter.x + particle.travelX + particle.laneOffset * laneEase
            particle.x += (targetX - particle.x) * 0.095 + wobble
          }

          particle.y += particle.vy * (1 - smoothWind * 0.10)
          particle.alpha -= 0.40 + smoothWind * 0.14
          particle.angle += particle.angularVelocity * (0.4 + smoothWind * 0.6)
        }

        applyPairwiseSeparation()

        for (const particle of particles) {
          const img = starImages[particle.imageIndex]
          if (!img) continue

          const assetScale = STAR_VISUAL_SCALE[particle.imageIndex] ?? 0.94
          const growthProgress = s.constrain((particle.age - 1) / 96, 0, 1)
          const growthEase = growthProgress * growthProgress * (3 - 2 * growthProgress)
          const growthMultiplier = s.lerp(0.38, 1.0, growthEase)
          const visualSize = particle.baseSize * assetScale * growthMultiplier

          s.push()
          s.translate(particle.x, particle.y)
          s.rotate(particle.angle)
          s.tint(255, particle.alpha)
          s.imageMode(s.CENTER)
          s.image(img, 0, 0, visualSize, visualSize)
          s.pop()
        }
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
