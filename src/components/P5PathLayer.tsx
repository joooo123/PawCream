import { useEffect, useRef } from 'react'
import type { RenderedHomeRect } from './P5DreamLayer'

const FOOT_SRC = `${import.meta.env.BASE_URL}assets/foot.png`

// Coordinates are measured in the original 2048×1535 Home.png artwork.
// The route follows the center of the pink path from the foreground toward
// the front edge of the atelier.
const ROAD_CURVE = {
  start: { x: 760, y: 1515 },
  control1: { x: 835, y: 1390 },
  control2: { x: 1075, y: 1210 },
  end: { x: 985, y: 1015 },
} as const

const WALK_DURATION_MS = 4800
const CYCLE_PAUSE_MS = 1300
const FOOTSTEP_GAP = 0.115
const FOOT_LIFETIME_MS = 5200
const FOOT_SOURCE_WIDTH = 118
const FOOT_SIDE_OFFSET = 22
const PARTICLE_COUNT = 22

type Props = {
  homeRect: RenderedHomeRect | null
  awake: boolean
}

type Footstep = {
  progress: number
  bornAt: number
  side: -1 | 1
  twist: number
}

type ParticleSeed = {
  progressOffset: number
  side: number
  lift: number
  radius: number
  phase: number
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function cubicPoint(t: number) {
  const u = 1 - t
  const uu = u * u
  const tt = t * t
  return {
    x:
      uu * u * ROAD_CURVE.start.x +
      3 * uu * t * ROAD_CURVE.control1.x +
      3 * u * tt * ROAD_CURVE.control2.x +
      tt * t * ROAD_CURVE.end.x,
    y:
      uu * u * ROAD_CURVE.start.y +
      3 * uu * t * ROAD_CURVE.control1.y +
      3 * u * tt * ROAD_CURVE.control2.y +
      tt * t * ROAD_CURVE.end.y,
  }
}

function cubicTangent(t: number) {
  const u = 1 - t
  return {
    x:
      3 * u * u * (ROAD_CURVE.control1.x - ROAD_CURVE.start.x) +
      6 * u * t * (ROAD_CURVE.control2.x - ROAD_CURVE.control1.x) +
      3 * t * t * (ROAD_CURVE.end.x - ROAD_CURVE.control2.x),
    y:
      3 * u * u * (ROAD_CURVE.control1.y - ROAD_CURVE.start.y) +
      6 * u * t * (ROAD_CURVE.control2.y - ROAD_CURVE.control1.y) +
      3 * t * t * (ROAD_CURVE.end.y - ROAD_CURVE.control2.y),
  }
}

function sourceToViewport(
  point: { x: number; y: number },
  rect: RenderedHomeRect,
) {
  return {
    x: rect.left + point.x * rect.sourceScale,
    y: rect.top + point.y * rect.sourceScale,
  }
}

function seededParticles(): ParticleSeed[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => {
    const n = index + 1
    return {
      progressOffset: -0.19 + ((n * 37) % 100) / 100 * 0.23,
      side: -34 + ((n * 53) % 100) / 100 * 68,
      lift: -12 - ((n * 71) % 100) / 100 * 30,
      radius: 1.7 + ((n * 29) % 100) / 100 * 3.2,
      phase: ((n * 43) % 100) / 100 * Math.PI * 2,
    }
  })
}

export default function P5PathLayer({ homeRect, awake }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef({ homeRect, awake })

  useEffect(() => {
    stateRef.current = { homeRect, awake }
  }, [homeRect, awake])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const footImage = new Image()
    footImage.src = FOOT_SRC

    const particleSeeds = seededParticles()
    const footsteps: Footstep[] = []
    let animationFrame = 0
    let cycleStartedAt = performance.now()
    let lastStepIndex = -1
    let activity = 0
    let wasAwake = false

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(window.innerWidth * dpr))
      canvas.height = Math.max(1, Math.round(window.innerHeight * dpr))
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const addFootstepsUpTo = (progress: number, time: number) => {
      const nextStepIndex = Math.floor(progress / FOOTSTEP_GAP)
      while (lastStepIndex < nextStepIndex) {
        lastStepIndex += 1
        const stepProgress = Math.min(0.96, lastStepIndex * FOOTSTEP_GAP)
        footsteps.push({
          progress: stepProgress,
          bornAt: time,
          side: lastStepIndex % 2 === 0 ? -1 : 1,
          twist: lastStepIndex % 2 === 0 ? -0.045 : 0.045,
        })
      }
    }

    const drawFootstep = (foot: Footstep, time: number, rect: RenderedHomeRect) => {
      if (!footImage.complete || footImage.naturalWidth <= 0) return

      const age = time - foot.bornAt
      const life = clamp01(1 - age / FOOT_LIFETIME_MS)
      if (life <= 0) return

      const point = cubicPoint(foot.progress)
      const tangent = cubicTangent(foot.progress)
      const tangentLength = Math.max(1, Math.hypot(tangent.x, tangent.y))
      const normalX = -tangent.y / tangentLength
      const normalY = tangent.x / tangentLength
      const lateral = FOOT_SIDE_OFFSET * foot.side
      const placed = {
        x: point.x + normalX * lateral,
        y: point.y + normalY * lateral,
      }
      const viewport = sourceToViewport(placed, rect)
      const direction = Math.atan2(tangent.y, tangent.x) + Math.PI / 2 + foot.twist
      const fadeIn = clamp01(age / 260)
      const fadeOut = age > FOOT_LIFETIME_MS - 1200
        ? clamp01((FOOT_LIFETIME_MS - age) / 1200)
        : 1
      const alpha = 0.58 * fadeIn * fadeOut * activity
      const sourceWidth = FOOT_SOURCE_WIDTH * (0.9 + foot.progress * 0.18)
      const width = sourceWidth * rect.sourceScale
      const aspect = footImage.naturalHeight / footImage.naturalWidth
      const height = width * aspect
      const pop = 0.86 + 0.14 * Math.min(1, age / 320)

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(viewport.x, viewport.y)
      ctx.rotate(direction)
      ctx.scale(pop, pop)
      ctx.drawImage(footImage, -width / 2, -height / 2, width, height)
      ctx.restore()
    }

    const drawParticleTrail = (
      walkerProgress: number,
      time: number,
      rect: RenderedHomeRect,
    ) => {
      for (const seed of particleSeeds) {
        const t = clamp01(walkerProgress + seed.progressOffset)
        if (t <= 0 || t >= 1) continue

        const point = cubicPoint(t)
        const tangent = cubicTangent(t)
        const tangentLength = Math.max(1, Math.hypot(tangent.x, tangent.y))
        const normalX = -tangent.y / tangentLength
        const normalY = tangent.x / tangentLength
        const shimmer = Math.sin(time * 0.0035 + seed.phase)
        const sourcePoint = {
          x: point.x + normalX * (seed.side + shimmer * 7),
          y: point.y + normalY * (seed.side + shimmer * 7) + seed.lift + shimmer * 5,
        }
        const viewport = sourceToViewport(sourcePoint, rect)
        const radius = seed.radius * (0.75 + t * 0.25) * Math.max(0.72, rect.sourceScale * 2.2)
        const distanceFromHead = Math.abs(t - walkerProgress)
        const alpha = Math.max(0, 0.42 - distanceFromHead * 1.35) * activity

        ctx.beginPath()
        ctx.arc(viewport.x, viewport.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 181, 218, ${alpha})`
        ctx.fill()

        if ((Math.round(seed.phase * 10) + Math.round(time / 220)) % 5 === 0) {
          const arm = radius * 2.1
          ctx.strokeStyle = `rgba(255, 205, 229, ${alpha * 0.8})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(viewport.x - arm, viewport.y)
          ctx.lineTo(viewport.x + arm, viewport.y)
          ctx.moveTo(viewport.x, viewport.y - arm)
          ctx.lineTo(viewport.x, viewport.y + arm)
          ctx.stroke()
        }
      }
    }

    const draw = (time: number) => {
      const state = stateRef.current
      const rect = state.homeRect
      activity += ((state.awake ? 1 : 0) - activity) * 0.075

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      if (state.awake && !wasAwake) {
        cycleStartedAt = time
        lastStepIndex = -1
      }
      wasAwake = state.awake

      if (rect && activity > 0.01) {
        const cycleLength = WALK_DURATION_MS + CYCLE_PAUSE_MS
        const elapsed = Math.max(0, time - cycleStartedAt)
        const cyclePosition = elapsed % cycleLength
        const cycleIndex = Math.floor(elapsed / cycleLength)
        const walkerProgress = cyclePosition < WALK_DURATION_MS
          ? clamp01(cyclePosition / WALK_DURATION_MS)
          : 1

        if (cycleIndex > 0 && cyclePosition < 34) {
          lastStepIndex = -1
        }

        if (state.awake && cyclePosition < WALK_DURATION_MS) {
          addFootstepsUpTo(walkerProgress, time)
        }

        drawParticleTrail(walkerProgress, time, rect)

        for (const foot of footsteps) {
          drawFootstep(foot, time, rect)
        }
      }

      for (let index = footsteps.length - 1; index >= 0; index -= 1) {
        if (time - footsteps[index].bornAt > FOOT_LIFETIME_MS) {
          footsteps.splice(index, 1)
        }
      }

      animationFrame = window.requestAnimationFrame(draw)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    animationFrame = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 4,
      }}
    />
  )
}
