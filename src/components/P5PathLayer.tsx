import { useEffect, useRef } from 'react'
import type { RenderedHomeRect } from './P5DreamLayer'

const FOOT_SRC = '/assets/foot.png'

const ROAD_POINTS = [
  { x: 520, y: 920 },
  { x: 470, y: 840 },
  { x: 430, y: 760 },
  { x: 390, y: 680 },
  { x: 350, y: 600 },
]

type Props = {
  homeRect: RenderedHomeRect | null
}

type Foot = {
  progress: number
  born: number
  side: number
}

export default function P5PathLayer({ homeRect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!homeRect || !canvasRef.current) return

    const canvas = canvasRef.current
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const footImage = new Image()
    footImage.src = FOOT_SRC

    const feet: Foot[] = []
    let lastSpawn = 0

    const addFoot = () => {
      if (feet.length < 6) {
        feet.push({
          progress: 0,
          born: performance.now(),
          side: feet.length % 2 ? 1 : -1,
        })
      }
    }

    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (time - lastSpawn > 700) {
        addFoot()
        lastSpawn = time
      }

      feet.forEach((foot) => {
        foot.progress += 0.0008

        const p = Math.min(foot.progress, 1)
        const index = Math.min(
          ROAD_POINTS.length - 2,
          Math.floor(p * (ROAD_POINTS.length - 1)),
        )
        const local = p * (ROAD_POINTS.length - 1) - index
        const a = ROAD_POINTS[index]
        const b = ROAD_POINTS[index + 1]

        const x = a.x + (b.x - a.x) * local
        const y = a.y + (b.y - a.y) * local
        const scale = 0.12 + p * 0.2

        ctx.save()
        ctx.globalAlpha = Math.max(0, 0.55 - p * 0.25)
        ctx.translate(
          homeRect.left + x * homeRect.sourceScale + foot.side * 10,
          homeRect.top + y * homeRect.sourceScale,
        )
        ctx.scale(scale, scale)
        ctx.drawImage(footImage, -80, -80)
        ctx.restore()

        for (let i = 0; i < 3; i++) {
          ctx.beginPath()
          ctx.arc(
            homeRect.left + x * homeRect.sourceScale + Math.random() * 20 - 10,
            homeRect.top + y * homeRect.sourceScale + Math.random() * 20 - 10,
            2,
            0,
            Math.PI * 2,
          )
          ctx.fillStyle = 'rgba(255,180,210,0.35)'
          ctx.fill()
        }
      })

      requestAnimationFrame(draw)
    }

    requestAnimationFrame(draw)
  }, [homeRect])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    />
  )
}
