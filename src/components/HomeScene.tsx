import { useEffect, useMemo, useRef, useState } from 'react'
import P5DreamLayer, { type RenderedHomeRect } from './P5DreamLayer'
import {
  ASSETS,
  HOME_ANCHORS,
  HOME_DISPLAY,
  HOME_SOURCE,
  MOTION,
} from '../sceneConfig'

type Props = {
  onEnter: () => void
}

type SceneState = 'idle' | 'awake' | 'entering'

function getContainRect(container: DOMRect): RenderedHomeRect {
  const sourceRatio = HOME_SOURCE.width / HOME_SOURCE.height
  const containerRatio = container.width / container.height

  let width: number
  let height: number

  if (sourceRatio > containerRatio) {
    width = container.width
    height = width / sourceRatio
  } else {
    height = container.height
    width = height * sourceRatio
  }

  const left = container.left + (container.width - width) / 2
  const top = container.top + (container.height - height) / 2

  return {
    left,
    top,
    width,
    height,
    sourceScale: width / HOME_SOURCE.width,
  }
}

function sourcePointToViewport(
  point: { x: number; y: number },
  rect: RenderedHomeRect,
) {
  return {
    x: rect.left + point.x * rect.sourceScale,
    y: rect.top + point.y * rect.sourceScale,
  }
}

function sourceRectToPercent() {
  return {
    left: `${(HOME_ANCHORS.houseHotspot.x / HOME_SOURCE.width) * 100}%`,
    top: `${(HOME_ANCHORS.houseHotspot.y / HOME_SOURCE.height) * 100}%`,
    width: `${(HOME_ANCHORS.houseHotspot.width / HOME_SOURCE.width) * 100}%`,
    height: `${(HOME_ANCHORS.houseHotspot.height / HOME_SOURCE.height) * 100}%`,
  }
}

export default function HomeScene({ onEnter }: Props) {
  const artboardRef = useRef<HTMLDivElement | null>(null)
  const [sceneState, setSceneState] = useState<SceneState>('idle')
  const [renderedHomeRect, setRenderedHomeRect] = useState<RenderedHomeRect | null>(null)
  const [transitionStartedAt, setTransitionStartedAt] = useState<number | null>(null)
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)

  const entering = sceneState === 'entering'
  const awake = sceneState === 'awake' || entering

  const hotspotStyle = useMemo(() => sourceRectToPercent(), [])

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)')
    const update = () => setIsCoarsePointer(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    const update = () => {
      const node = artboardRef.current
      if (!node) return
      setRenderedHomeRect(getContainRect(node.getBoundingClientRect()))
    }

    update()
    const observer = new ResizeObserver(update)
    if (artboardRef.current) observer.observe(artboardRef.current)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
    }
  }, [])

  useEffect(() => {
    if (!isCoarsePointer || entering) return
    const timer = window.setTimeout(() => {
      setSceneState((current) => (current === 'idle' ? 'awake' : current))
    }, MOTION.mobileAutoWakeMs)
    return () => window.clearTimeout(timer)
  }, [isCoarsePointer, entering])

  const chimney = renderedHomeRect
    ? sourcePointToViewport(HOME_ANCHORS.chimney, renderedHomeRect)
    : null

  const beginEnter = () => {
    if (entering) return
    setSceneState('entering')
    setTransitionStartedAt(performance.now())
    window.setTimeout(onEnter, MOTION.enterDurationMs)
  }

  const onPointerEnter = () => {
    if (!entering) setSceneState('awake')
  }

  const onPointerLeave = () => {
    if (!entering && !isCoarsePointer) setSceneState('idle')
  }

  return (
    <main className={`home-scene home-scene--${sceneState}`}>
      <P5DreamLayer
        awake={awake}
        entering={entering}
        transitionStartedAt={transitionStartedAt}
        homeRect={renderedHomeRect}
        chimney={chimney}
      />

      <div className="home-stage" aria-label="PawCream illustrated home">
        <div
          ref={artboardRef}
          className="home-artboard"
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
        >
          <img
            src={ASSETS.home}
            className="home-artwork"
            draggable={false}
            alt="PawCream dreamy illustrated atelier house"
          />

          <button
            className="house-hotspot"
            style={hotspotStyle}
            type="button"
            aria-label="Enter PawCream atelier"
            onFocus={onPointerEnter}
            onBlur={onPointerLeave}
            onClick={beginEnter}
          >
            <span className="sr-only">Enter PawCream atelier</span>
          </button>
        </div>
      </div>
    </main>
  )
}
