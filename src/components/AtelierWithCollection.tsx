import { useEffect, useMemo, useState } from 'react'
import AtelierWithLetter from './AtelierWithLetter'

type DeviceProfile = 'desktop' | 'mobile'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

type Slot = {
  id: string
  label: string
  front: string
  back?: string
  x: number
  y: number
  width: number
  height: number
}

type LookbookItem = {
  id: string
  title: string
  base: string
  slots: Slot[]
}

const BASE_URL = import.meta.env.BASE_URL
const COLLECTION_ROOT = `${BASE_URL}assets/collection/${encodeURIComponent('青空小蓓')}/`
const asset = (name: string) => `${COLLECTION_ROOT}${encodeURIComponent(name)}`

const LOOKBOOK_ITEMS: LookbookItem[] = [
  {
    id: 'qingkong-xiaobei',
    title: '青空小蓓',
    base: asset('空白青空小蓓.png'),
    slots: [
      {
        id: 'headband',
        label: '发箍 · 点击翻面',
        front: asset('真丝发箍.png'),
        back: asset('波点发箍.png'),
        x: 62.3,
        y: 9.3,
        width: 32.5,
        height: 17.1,
      },
      {
        id: 'dress',
        label: '裙子 · 点击翻面',
        front: asset('裙子一面.png'),
        back: asset('裙子另一面.png'),
        x: 62.3,
        y: 27.6,
        width: 32.5,
        height: 22.6,
      },
      {
        id: 'bloomer',
        label: '花苞裤',
        front: asset('花苞裤.png'),
        x: 62.3,
        y: 51.4,
        width: 32.5,
        height: 17.2,
      },
      {
        id: 'socks',
        label: '袜子',
        front: asset('袜子.png'),
        x: 62.3,
        y: 69.9,
        width: 32.5,
        height: 21.2,
      },
    ],
  },
]

const preloadUrls = Array.from(new Set(
  LOOKBOOK_ITEMS.flatMap((item) => [
    item.base,
    ...item.slots.flatMap((slot) => slot.back ? [slot.front, slot.back] : [slot.front]),
  ]),
))

let collectionPreloadPromise: Promise<void> | null = null
const collectionPreloadImages: HTMLImageElement[] = []

function preloadCollectionAssets() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (collectionPreloadPromise) return collectionPreloadPromise

  collectionPreloadPromise = Promise.all(preloadUrls.map((src, index) => new Promise<void>((resolve) => {
    const image = new Image()
    collectionPreloadImages.push(image)
    image.decoding = 'async'
    if (index === 0) image.fetchPriority = 'high'

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      if (typeof image.decode === 'function') {
        image.decode().catch(() => undefined).finally(resolve)
      } else {
        resolve()
      }
    }

    image.onload = finish
    image.onerror = finish
    image.src = src
    if (image.complete && image.naturalWidth > 0) finish()
  }))).then(() => undefined)

  return collectionPreloadPromise
}

export default function AtelierWithCollection(props: Props) {
  const [open, setOpen] = useState(false)
  const [itemIndex, setItemIndex] = useState(0)
  const [flipped, setFlipped] = useState<Record<string, boolean>>({})

  const query = useMemo(
    () => typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search),
    [],
  )
  const tuneMode = query.get('tune') === '1'
  const letterTuneMode = query.get('letterTune') === '1'
  const mobile = props.deviceProfile === 'mobile'
  const current = LOOKBOOK_ITEMS[itemIndex]

  const openLookbook = () => {
    void preloadCollectionAssets()
    setItemIndex(0)
    setFlipped({})
    setOpen(true)
  }

  const closeLookbook = () => setOpen(false)

  const shiftItem = (direction: -1 | 1) => {
    if (LOOKBOOK_ITEMS.length <= 1) return
    setItemIndex((index) => (index + direction + LOOKBOOK_ITEMS.length) % LOOKBOOK_ITEMS.length)
    setFlipped({})
  }

  useEffect(() => {
    if (tuneMode || letterTuneMode) return
    void preloadCollectionAssets()
  }, [tuneMode, letterTuneMode])

  useEffect(() => {
    if (tuneMode || letterTuneMode) return

    const image = document.querySelector<HTMLImageElement>(
      'section[aria-label^="PawCream Atelier Room"] img[alt="People"]',
    )
    const control = image?.parentElement
    if (!control) return

    const oldRole = control.getAttribute('role')
    const oldTabIndex = control.getAttribute('tabindex')
    const oldLabel = control.getAttribute('aria-label')
    const oldCursor = control.style.cursor

    control.setAttribute('role', 'button')
    control.setAttribute('tabindex', '0')
    control.setAttribute('aria-label', 'Collection lookbook interaction')
    control.style.cursor = 'pointer'

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('[aria-label="Collection lookbook interaction"]')) return
      event.preventDefault()
      openLookbook()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        closeLookbook()
        return
      }
      if (event.key !== 'Enter' && event.key !== ' ') return
      const target = event.target as Element | null
      if (!target?.closest('[aria-label="Collection lookbook interaction"]')) return
      event.preventDefault()
      openLookbook()
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKeyDown, true)
      if (oldRole === null) control.removeAttribute('role')
      else control.setAttribute('role', oldRole)
      if (oldTabIndex === null) control.removeAttribute('tabindex')
      else control.setAttribute('tabindex', oldTabIndex)
      if (oldLabel === null) control.removeAttribute('aria-label')
      else control.setAttribute('aria-label', oldLabel)
      control.style.cursor = oldCursor
    }
  }, [props.deviceProfile, tuneMode, letterTuneMode, open])

  useEffect(() => {
    if (!open) return
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = oldOverflow
    }
  }, [open])

  return (
    <>
      <AtelierWithLetter {...props} />

      {open && !tuneMode && !letterTuneMode && (
        <div
          className="pawcream-lookbook-overlay"
          role="presentation"
          onClick={closeLookbook}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 158,
            display: 'grid',
            placeItems: 'center',
            padding: mobile ? 10 : 20,
            background: 'rgba(203, 229, 232, .54)',
            backdropFilter: 'blur(14px) saturate(108%)',
            WebkitBackdropFilter: 'blur(14px) saturate(108%)',
          }}
        >
          <style>{`
            .pawcream-lookbook-stage {
              position: relative;
              aspect-ratio: 2 / 3;
              isolation: isolate;
              filter: drop-shadow(0 26px 40px rgba(59, 104, 112, .18));
              animation: pawcream-lookbook-enter 460ms cubic-bezier(.2,.78,.24,1) both;
            }
            .pawcream-lookbook-base {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              display: block;
              object-fit: contain;
              user-select: none;
              pointer-events: none;
            }
            .pawcream-lookbook-slot {
              position: absolute;
              perspective: 1100px;
              cursor: default;
              border: 0;
              padding: 0;
              background: transparent;
              -webkit-tap-highlight-color: transparent;
            }
            .pawcream-lookbook-slot.is-flippable {
              cursor: pointer;
              transition: transform 180ms ease, filter 180ms ease;
            }
            .pawcream-lookbook-slot.is-flippable:hover {
              transform: translateY(-2px) scale(1.012);
              filter: drop-shadow(0 8px 13px rgba(85, 117, 119, .12));
            }
            .pawcream-lookbook-slot.is-flippable::after {
              content: '↻';
              position: absolute;
              right: 4%;
              bottom: 5%;
              z-index: 5;
              display: grid;
              place-items: center;
              width: 22px;
              height: 22px;
              border-radius: 999px;
              background: rgba(255,255,255,.72);
              color: rgba(87, 132, 139, .72);
              box-shadow: 0 3px 9px rgba(87, 132, 139, .10);
              font-family: ui-sans-serif, system-ui, sans-serif;
              font-size: 14px;
              line-height: 1;
              opacity: 0;
              transform: scale(.8);
              transition: opacity 160ms ease, transform 160ms ease;
              pointer-events: none;
            }
            .pawcream-lookbook-slot.is-flippable:hover::after,
            .pawcream-lookbook-slot.is-flipped::after {
              opacity: .82;
              transform: scale(1);
            }
            .pawcream-lookbook-flip {
              position: absolute;
              inset: 0;
              transform-style: preserve-3d;
              transition: transform 620ms cubic-bezier(.22,.72,.22,1);
            }
            .pawcream-lookbook-slot.is-flipped .pawcream-lookbook-flip {
              transform: rotateY(180deg);
            }
            .pawcream-lookbook-face {
              position: absolute;
              inset: 0;
              display: grid;
              place-items: center;
              backface-visibility: hidden;
              -webkit-backface-visibility: hidden;
            }
            .pawcream-lookbook-face.is-back { transform: rotateY(180deg); }
            .pawcream-lookbook-face img {
              display: block;
              width: 100%;
              height: 100%;
              object-fit: contain;
              user-select: none;
              pointer-events: none;
            }
            .pawcream-lookbook-close,
            .pawcream-lookbook-arrow {
              position: absolute;
              z-index: 12;
              display: grid;
              place-items: center;
              border: 1px solid rgba(111, 161, 169, .28);
              background: rgba(255,255,255,.9);
              color: #618f96;
              box-shadow: 0 7px 20px rgba(73, 113, 121, .12);
              cursor: pointer;
              transition: transform 160ms ease, background 160ms ease;
            }
            .pawcream-lookbook-close:hover,
            .pawcream-lookbook-arrow:hover {
              background: #e7f3f3;
              transform: scale(1.06);
            }
            .pawcream-lookbook-close {
              top: 8px;
              right: -52px;
              width: 40px;
              height: 40px;
              border-radius: 50%;
              font-size: 25px;
              line-height: 1;
            }
            .pawcream-lookbook-arrow {
              top: 50%;
              width: 42px;
              height: 42px;
              border-radius: 50%;
              transform: translateY(-50%);
              font-size: 24px;
            }
            .pawcream-lookbook-arrow:hover { transform: translateY(-50%) scale(1.06); }
            .pawcream-lookbook-arrow.is-prev { left: -58px; }
            .pawcream-lookbook-arrow.is-next { right: -58px; }
            .pawcream-lookbook-counter {
              position: absolute;
              left: 50%;
              bottom: -28px;
              z-index: 12;
              transform: translateX(-50%);
              color: rgba(72, 116, 124, .78);
              font-family: 'PawCream EN', ui-sans-serif, sans-serif;
              font-size: 13px;
              letter-spacing: .08em;
              white-space: nowrap;
            }
            @keyframes pawcream-lookbook-enter {
              from { opacity: 0; transform: translateY(12px) scale(.975); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @media (hover: none) {
              .pawcream-lookbook-slot.is-flippable::after {
                opacity: .48;
                transform: scale(.92);
              }
            }
            @media (max-width: 700px) {
              .pawcream-lookbook-close {
                top: 7px;
                right: 7px;
                width: 36px;
                height: 36px;
                font-size: 22px;
              }
              .pawcream-lookbook-arrow {
                width: 36px;
                height: 36px;
                background: rgba(255,255,255,.82);
              }
              .pawcream-lookbook-arrow.is-prev { left: 7px; }
              .pawcream-lookbook-arrow.is-next { right: 7px; }
              .pawcream-lookbook-counter { bottom: 8px; font-size: 11px; }
              .pawcream-lookbook-slot.is-flippable::after {
                width: 18px;
                height: 18px;
                font-size: 12px;
              }
            }
          `}</style>

          <section
            key={current.id}
            role="dialog"
            aria-modal="true"
            aria-label={`${current.title} 作品展示册`}
            className="pawcream-lookbook-stage"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: mobile
                ? 'min(460px, calc(100vw - 20px), calc((100svh - 20px) * .666667))'
                : 'min(560px, calc(100vw - 140px), calc((100svh - 44px) * .666667))',
            }}
          >
            <img
              src={current.base}
              alt={`${current.title} 海报`}
              draggable={false}
              decoding="async"
              className="pawcream-lookbook-base"
            />

            {current.slots.map((slot) => {
              const isFlipped = Boolean(flipped[slot.id])
              const flippable = Boolean(slot.back)
              return (
                <button
                  key={slot.id}
                  type="button"
                  aria-label={slot.label}
                  aria-pressed={flippable ? isFlipped : undefined}
                  disabled={!flippable}
                  className={`pawcream-lookbook-slot${flippable ? ' is-flippable' : ''}${isFlipped ? ' is-flipped' : ''}`}
                  onClick={() => {
                    if (!flippable) return
                    setFlipped((currentState) => ({
                      ...currentState,
                      [slot.id]: !currentState[slot.id],
                    }))
                  }}
                  style={{
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    width: `${slot.width}%`,
                    height: `${slot.height}%`,
                  }}
                >
                  <span className="pawcream-lookbook-flip">
                    <span className="pawcream-lookbook-face">
                      <img src={slot.front} alt="" aria-hidden="true" draggable={false} decoding="async" />
                    </span>
                    {slot.back && (
                      <span className="pawcream-lookbook-face is-back">
                        <img src={slot.back} alt="" aria-hidden="true" draggable={false} decoding="async" />
                      </span>
                    )}
                  </span>
                </button>
              )
            })}

            <button
              type="button"
              className="pawcream-lookbook-close"
              aria-label="关闭作品展示册"
              onClick={closeLookbook}
            >
              ×
            </button>

            {LOOKBOOK_ITEMS.length > 1 && (
              <>
                <button type="button" className="pawcream-lookbook-arrow is-prev" aria-label="上一件作品" onClick={() => shiftItem(-1)}>‹</button>
                <button type="button" className="pawcream-lookbook-arrow is-next" aria-label="下一件作品" onClick={() => shiftItem(1)}>›</button>
              </>
            )}

            <div className="pawcream-lookbook-counter" aria-hidden="true">
              {String(itemIndex + 1).padStart(2, '0')} / {String(LOOKBOOK_ITEMS.length).padStart(2, '0')}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
