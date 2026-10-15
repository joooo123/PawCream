import { useEffect, useRef } from 'react'
import { ASSETS } from '../sceneConfig'
import type { StarTuning } from '../sceneConfig'

export type RenderedHomeRect = { left: number; top: number; width: number; height: number; sourceScale: number }
export type DreamClipRect = { left: number; top: number; width: number; height: number; radius?: number }
type Props = {
  awake: boolean
  entering: boolean
  transitionStartedAt: number | null
  homeRect: RenderedHomeRect | null
  chimney: { x: number; y: number } | null
  tuning: StarTuning
  clipRect?: DreamClipRect | null
}
type Star = { born: number; track: number; image: number; size: number; dx: number; angle: number; spin: number }
const ease = (t: number) => t * t * (3 - 2 * t)
const curve = (a: number, b: number, c: number, t: number) =>
  (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c

// Small Canvas renderer for the XHS offline runtime (no p5 or dynamic evaluation).
// All star images and coordinates come from the original Home scene configuration.
export default function P5DreamLayer(props: Props) {
  const host = useRef<HTMLDivElement | null>(null)
  const latest = useRef(props)
  latest.current = props

  useEffect(() => {
    const node = host.current
    if (!node) return
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-label', 'PawCream animated stars')
    canvas.style.pointerEvents = 'none'
    node.appendChild(canvas)
    const ctx = canvas.getContext('2d')
    if (!ctx) return () => canvas.remove()

    const images: HTMLImageElement[] = []
    for (const src of ASSETS.stars) {
      const image = new Image()
      image.src = src
      images.push(image)
    }
    const stars: Star[] = []
    let stopped = false
    let frameId = 0
    let nextSpawn = performance.now()
    let sequence = 0
    let painted = 0
    let lastWidth = 0, lastHeight = 0, lastRatio = 0

    const draw = (now: number) => {
      if (stopped) return
      const state = latest.current
      const { chimney, tuning, awake, entering } = state
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      const w = window.innerWidth, h = window.innerHeight
      if (w !== lastWidth || h !== lastHeight || ratio !== lastRatio) {
        canvas.width = Math.round(w * ratio)
        canvas.height = Math.round(h * ratio)
        canvas.style.width = w + 'px'
        canvas.style.height = h + 'px'
        lastWidth = w; lastHeight = h; lastRatio = ratio
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const loaded = images.map((image, i) => image.complete && image.naturalWidth > 0 ? i : -1).filter(i => i >= 0)
      if (awake && !entering && chimney && loaded.length && tuning.tracks.length &&
          now >= nextSpawn && stars.length < Math.max(1, tuning.maxStars)) {
        const count = Math.min(Math.max(1, tuning.burstStars), tuning.maxStars - stars.length)
        for (let i = 0; i < count; i++) {
          stars.push({
            born: now + i * Math.max(25, tuning.burstStaggerMs),
            track: (sequence + i) % tuning.tracks.length,
            image: loaded[(sequence + i) % loaded.length],
            size: (i % 2) / 2 + .3,
            dx: ((i % 3) - 1) * .35,
            angle: (i * 39) * Math.PI / 180,
            spin: i % 2 ? .16 : -.18,
          })
        }
        sequence += count
        nextSpawn = now + Math.max(200, (tuning.spawnMinMs + tuning.spawnMaxMs) / 2)
      }

      let visible = 0
      for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i]
        const track = tuning.tracks[star.track % tuning.tracks.length]
        if (!track || entering) { stars.splice(i, 1); continue }
        const elapsed = now - star.born
        if (elapsed < 0) continue
        const t = elapsed / Math.max(1000, tuning.pathDurationMs)
        if (t >= 1) { stars.splice(i, 1); continue }
        const image = images[star.image]
        if (!image || !image.naturalWidth || !chimney) continue
        const u = ease(t)
        const x0 = chimney.x + tuning.spawnX, y0 = chimney.y + tuning.spawnY
        const sway = Math.sin(t * Math.PI * 5 + star.dx) * tuning.wobbleAmp * Math.sin(Math.PI * t)
        const x = curve(x0, x0 + track.curveX, x0 + track.endX, u) + sway + star.dx * tuning.laneSpread
        const y = curve(y0, y0 + track.curveY, y0 + track.endY, u)
        const size = (tuning.sizeMin + (tuning.sizeMax - tuning.sizeMin) * star.size) *
          (track.startScale + (track.endScale - track.startScale) * t)
        const alpha = t < .68 ? 1 : 1 - ease(Math.min(1, (t - .68) / .32))
        ctx.save()
        if (state.clipRect) {
          const rect = state.clipRect
          ctx.beginPath()
          ctx.rect(rect.left, rect.top, rect.width, rect.height)
          ctx.clip()
        }
        ctx.globalAlpha = alpha
        ctx.translate(x, y)
        ctx.rotate(star.angle + star.spin * elapsed / 1000)
        ctx.drawImage(image, -size / 2, -size / 2 * image.naturalHeight / image.naturalWidth,
          size, size * image.naturalHeight / image.naturalWidth)
        ctx.restore()
        visible++
      }
      if (visible) painted += visible
      canvas.dataset.starDrawCount = String(painted)
      frameId = requestAnimationFrame(draw)
    }
    frameId = requestAnimationFrame(draw)
    return () => { stopped = true; cancelAnimationFrame(frameId); canvas.remove() }
  }, [])
  return <div ref={host} className="p5-dream-layer" aria-hidden="true" />
}
