import { useEffect, useMemo, useState } from 'react'
import AtelierWithLetter from './AtelierWithLetter'

type DeviceProfile = 'desktop' | 'mobile'
type FaceName = 'front' | 'back'

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

type FaceTune = {
  offsetX: number
  offsetY: number
  scale: number
}

type SlotTune = {
  x: number
  y: number
  width: number
  height: number
  front: FaceTune
  back: FaceTune
}

type TuneProfiles = Record<string, Record<string, SlotTune>>

const BASE_URL = import.meta.env.BASE_URL
const collectionAsset = (folder: string, name: string) =>
  `${BASE_URL}assets/collection/${encodeURIComponent(folder)}/${encodeURIComponent(name)}`
const qingkongAsset = (name: string) => collectionAsset('青空小蓓', name)
const summerAsset = (name: string) => collectionAsset('夏日海盐波波', name)
const COLLECTION_TUNE_STORAGE_KEY = 'pawcream-collection-tune-v1'

const LOOKBOOK_ITEMS: LookbookItem[] = [
  {
    id: 'qingkong-xiaobei',
    title: '青空小蓓',
    base: qingkongAsset('空白青空小蓓.png'),
    slots: [
      {
        id: 'headband',
        label: '发箍',
        front: qingkongAsset('真丝发箍.png'),
        back: qingkongAsset('波点发箍.png'),
        x: 64.8,
        y: 6.1,
        width: 30.1,
        height: 17.1,
      },
      {
        id: 'dress',
        label: '裙子',
        front: qingkongAsset('裙子一面.png'),
        back: qingkongAsset('裙子另一面.png'),
        x: 62.9,
        y: 27.6,
        width: 30.3,
        height: 22.6,
      },
      {
        id: 'bloomer',
        label: '花苞裤',
        front: qingkongAsset('花苞裤.png'),
        x: 63.2,
        y: 49.3,
        width: 29.2,
        height: 17.2,
      },
      {
        id: 'socks',
        label: '袜子',
        front: qingkongAsset('袜子.png'),
        x: 64.5,
        y: 70.8,
        width: 27.7,
        height: 21.2,
      },
    ],
  },
  {
    id: 'summer-sea-salt-bobo',
    title: '夏日海盐波波',
    base: summerAsset('海盐夏日波波.png'),
    slots: [],
  },
]

const preloadUrls = Array.from(new Set(
  LOOKBOOK_ITEMS.flatMap((item) => [
    item.base,
    ...item.slots.flatMap((slot) => slot.back ? [slot.front, slot.back] : [slot.front]),
  ]),
))

const defaultFaceTune = (): FaceTune => ({ offsetX: 0, offsetY: 0, scale: 1 })

function buildDefaultTuneProfiles(): TuneProfiles {
  return LOOKBOOK_ITEMS.reduce((items, item) => {
    items[item.id] = item.slots.reduce((slots, slot) => {
      slots[slot.id] = {
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        front: defaultFaceTune(),
        back: defaultFaceTune(),
      }
      return slots
    }, {} as Record<string, SlotTune>)
    return items
  }, {} as TuneProfiles)
}

function cloneTuneProfiles(source: TuneProfiles): TuneProfiles {
  return Object.fromEntries(
    Object.entries(source).map(([itemId, slots]) => [
      itemId,
      Object.fromEntries(
        Object.entries(slots).map(([slotId, tune]) => [
          slotId,
          {
            ...tune,
            front: { ...tune.front },
            back: { ...tune.back },
          },
        ]),
      ),
    ]),
  )
}

function finite(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function loadTuneProfiles(): TuneProfiles {
  const defaults = buildDefaultTuneProfiles()
  if (typeof window === 'undefined') return defaults

  try {
    const raw = window.localStorage.getItem(COLLECTION_TUNE_STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<TuneProfiles>
    const merged = cloneTuneProfiles(defaults)

    for (const item of LOOKBOOK_ITEMS) {
      for (const slot of item.slots) {
        const saved = parsed[item.id]?.[slot.id]
        if (!saved) continue
        const target = merged[item.id][slot.id]
        target.x = finite(saved.x, target.x)
        target.y = finite(saved.y, target.y)
        target.width = finite(saved.width, target.width)
        target.height = finite(saved.height, target.height)
        target.front = {
          offsetX: finite(saved.front?.offsetX, target.front.offsetX),
          offsetY: finite(saved.front?.offsetY, target.front.offsetY),
          scale: finite(saved.front?.scale, target.front.scale),
        }
        target.back = {
          offsetX: finite(saved.back?.offsetX, target.back.offsetX),
          offsetY: finite(saved.back?.offsetY, target.back.offsetY),
          scale: finite(saved.back?.scale, target.back.scale),
        }
      }
    }

    return merged
  } catch {
    return defaults
  }
}

function TuneRow({ label, value, min, max, step, suffix, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '88px 1fr 82px', alignItems: 'center', gap: 10, minHeight: 38, fontSize: 15 }}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        style={{ width: '100%', accentColor: '#77aeb6', cursor: 'ew-resize' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const next = Number(event.currentTarget.value)
            if (Number.isFinite(next)) onChange(next)
          }}
          style={{
            width: 64,
            minHeight: 30,
            border: '1px solid rgba(92,145,154,.24)',
            borderRadius: 8,
            background: 'rgba(255,255,255,.92)',
            color: '#567a80',
            fontSize: 14,
            padding: '3px 6px',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
        <span style={{ fontSize: 12, color: '#8aa3a6' }}>{suffix}</span>
      </div>
    </label>
  )
}

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
  const query = useMemo(
    () => typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search),
    [],
  )
  const tuneMode = query.get('tune') === '1'
  const letterTuneMode = query.get('letterTune') === '1'
  const collectionTuneMode = query.get('collectionTune') === '1'

  const [open, setOpen] = useState(collectionTuneMode)
  const [itemIndex, setItemIndex] = useState(0)
  const [flipped, setFlipped] = useState<Record<string, boolean>>({})
  const [tuning, setTuning] = useState<TuneProfiles>(loadTuneProfiles)
  const [savedTuning, setSavedTuning] = useState<TuneProfiles>(loadTuneProfiles)
  const [selectedSlotId, setSelectedSlotId] = useState(LOOKBOOK_ITEMS[0].slots[0]?.id ?? '')
  const [selectedFace, setSelectedFace] = useState<FaceName>('front')
  const [copyStatus, setCopyStatus] = useState('')

  const mobile = props.deviceProfile === 'mobile'
  const current = LOOKBOOK_ITEMS[itemIndex]
  const currentTune = tuning[current.id] ?? {}
  const selectedSlot = current.slots.find((slot) => slot.id === selectedSlotId) ?? current.slots[0]
  const selectedTune = selectedSlot ? currentTune[selectedSlot.id] : undefined
  const selectedFaceTune = selectedTune ? selectedTune[selectedFace] : undefined
  const dirty = JSON.stringify(tuning) !== JSON.stringify(savedTuning)

  const openLookbook = () => {
    void preloadCollectionAssets()
    setItemIndex(0)
    setFlipped({})
    setSelectedSlotId(LOOKBOOK_ITEMS[0].slots[0]?.id ?? '')
    setSelectedFace('front')
    setOpen(true)
  }

  const closeLookbook = () => {
    if (collectionTuneMode) return
    setOpen(false)
  }

  const shiftItem = (direction: -1 | 1) => {
    const next = (itemIndex + direction + LOOKBOOK_ITEMS.length) % LOOKBOOK_ITEMS.length
    setItemIndex(next)
    setSelectedSlotId(LOOKBOOK_ITEMS[next].slots[0]?.id ?? '')
    setSelectedFace('front')
    setFlipped({})
  }

  const selectSlot = (slot: Slot) => {
    setSelectedSlotId(slot.id)
    const face: FaceName = slot.back && flipped[slot.id] ? 'back' : 'front'
    setSelectedFace(face)
  }

  const previewFace = (face: FaceName) => {
    if (!selectedSlot) return
    if (face === 'back' && !selectedSlot.back) return
    setSelectedFace(face)
    setFlipped((state) => ({ ...state, [selectedSlot.id]: face === 'back' }))
  }

  const updateSelectedSlot = (patch: Partial<Omit<SlotTune, 'front' | 'back'>>) => {
    if (!selectedSlot) return
    setTuning((profiles) => ({
      ...profiles,
      [current.id]: {
        ...profiles[current.id],
        [selectedSlot.id]: {
          ...profiles[current.id][selectedSlot.id],
          ...patch,
        },
      },
    }))
  }

  const updateSelectedFace = (patch: Partial<FaceTune>) => {
    if (!selectedSlot) return
    setTuning((profiles) => {
      const slotTune = profiles[current.id][selectedSlot.id]
      return {
        ...profiles,
        [current.id]: {
          ...profiles[current.id],
          [selectedSlot.id]: {
            ...slotTune,
            [selectedFace]: {
              ...slotTune[selectedFace],
              ...patch,
            },
          },
        },
      }
    })
  }

  const saveTune = () => {
    window.localStorage.setItem(COLLECTION_TUNE_STORAGE_KEY, JSON.stringify(tuning))
    setSavedTuning(cloneTuneProfiles(tuning))
    setCopyStatus('✓ 已保存')
  }

  const restoreTune = () => {
    const restored = loadTuneProfiles()
    setTuning(restored)
    setSavedTuning(cloneTuneProfiles(restored))
    setCopyStatus('已恢复已保存参数')
  }

  const resetTune = () => {
    setTuning(buildDefaultTuneProfiles())
    setCopyStatus('已恢复默认值，尚未保存')
  }

  const copyTune = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({
        item: current.title,
        itemId: current.id,
        slots: tuning[current.id],
      }, null, 2))
      setCopyStatus('✓ 参数已复制')
    } catch {
      setCopyStatus('复制失败')
    }
  }

  useEffect(() => {
    if (tuneMode || letterTuneMode) return
    void preloadCollectionAssets()
  }, [tuneMode, letterTuneMode])

  useEffect(() => {
    if (!collectionTuneMode) return
    void preloadCollectionAssets()
    setOpen(true)
  }, [collectionTuneMode])

  useEffect(() => {
    if (tuneMode || letterTuneMode || collectionTuneMode) return

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
  }, [props.deviceProfile, tuneMode, letterTuneMode, collectionTuneMode, open])

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
            .pawcream-lookbook-slot.is-flippable { cursor: pointer; }
            .pawcream-lookbook-slot:not(.is-tuning).is-flippable {
              transition: transform 180ms ease, filter 180ms ease;
            }
            .pawcream-lookbook-slot:not(.is-tuning).is-flippable:hover {
              transform: translateY(-2px) scale(1.012);
              filter: drop-shadow(0 8px 13px rgba(85, 117, 119, .12));
            }
            .pawcream-lookbook-slot.is-tuning {
              cursor: crosshair;
              outline: 1px dashed rgba(55, 126, 138, .34);
              outline-offset: -1px;
            }
            .pawcream-lookbook-slot.is-tuning.is-selected {
              outline: 3px solid rgba(57, 139, 151, .78);
              background: rgba(104, 186, 197, .06);
              z-index: 10;
            }
            .pawcream-lookbook-flip {
              position: absolute;
              inset: 0;
              transform-style: preserve-3d;
              transition: transform 620ms cubic-bezier(.22,.72,.22,1);
            }
            .pawcream-lookbook-slot.is-flipped .pawcream-lookbook-flip { transform: rotateY(180deg); }
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
              transform-origin: center center;
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
            .pawcream-lookbook-arrow:hover { background: #e7f3f3; }
            .pawcream-lookbook-close {
              top: 8px;
              right: -52px;
              width: 40px;
              height: 40px;
              border-radius: 50%;
              font-size: 25px;
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
              width: collectionTuneMode && !mobile
                ? 'min(520px, calc(100vw - 610px), calc((100svh - 44px) * .666667))'
                : mobile
                  ? 'min(460px, calc(100vw - 20px), calc((100svh - 20px) * .666667))'
                  : 'min(560px, calc(100vw - 140px), calc((100svh - 44px) * .666667))',
              marginRight: collectionTuneMode && !mobile ? 500 : 0,
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
              const slotTune = currentTune[slot.id]
              if (!slotTune) return null
              const isFlipped = Boolean(flipped[slot.id])
              const flippable = Boolean(slot.back)

              return (
                <button
                  key={slot.id}
                  type="button"
                  aria-label={slot.label}
                  aria-pressed={flippable ? isFlipped : undefined}
                  disabled={!flippable && !collectionTuneMode}
                  className={`pawcream-lookbook-slot${flippable ? ' is-flippable' : ''}${isFlipped ? ' is-flipped' : ''}${collectionTuneMode ? ' is-tuning' : ''}${collectionTuneMode && selectedSlot?.id === slot.id ? ' is-selected' : ''}`}
                  onClick={() => {
                    if (collectionTuneMode) {
                      selectSlot(slot)
                      return
                    }
                    if (!flippable) return
                    setFlipped((state) => ({ ...state, [slot.id]: !state[slot.id] }))
                  }}
                  style={{
                    left: `${slotTune.x}%`,
                    top: `${slotTune.y}%`,
                    width: `${slotTune.width}%`,
                    height: `${slotTune.height}%`,
                  }}
                >
                  <span className="pawcream-lookbook-flip">
                    <span className="pawcream-lookbook-face">
                      <img
                        src={slot.front}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        decoding="async"
                        style={{ transform: `translate3d(${slotTune.front.offsetX}%, ${slotTune.front.offsetY}%, 0) scale(${slotTune.front.scale})` }}
                      />
                    </span>
                    {slot.back && (
                      <span className="pawcream-lookbook-face is-back">
                        <img
                          src={slot.back}
                          alt=""
                          aria-hidden="true"
                          draggable={false}
                          decoding="async"
                          style={{ transform: `translate3d(${slotTune.back.offsetX}%, ${slotTune.back.offsetY}%, 0) scale(${slotTune.back.scale})` }}
                        />
                      </span>
                    )}
                  </span>
                </button>
              )
            })}

            {!collectionTuneMode && (
              <button type="button" className="pawcream-lookbook-close" aria-label="关闭作品展示册" onClick={closeLookbook}>×</button>
            )}

            <button type="button" className="pawcream-lookbook-arrow is-prev" aria-label="上一件作品" onClick={() => shiftItem(-1)}>‹</button>
            <button type="button" className="pawcream-lookbook-arrow is-next" aria-label="下一件作品" onClick={() => shiftItem(1)}>›</button>

            {!collectionTuneMode && (
              <div className="pawcream-lookbook-counter" aria-hidden="true">
                {String(itemIndex + 1).padStart(2, '0')} / {String(LOOKBOOK_ITEMS.length).padStart(2, '0')}
              </div>
            )}
          </section>

          {collectionTuneMode && (
            <aside
              onClick={(event) => event.stopPropagation()}
              style={{
                position: 'fixed',
                top: 14,
                right: 14,
                zIndex: 190,
                width: 'min(540px, calc(100vw - 28px))',
                maxHeight: 'calc(100svh - 28px)',
                overflow: 'auto',
                padding: 18,
                border: '1px solid rgba(80, 139, 148, .24)',
                borderRadius: 18,
                background: 'rgba(246, 253, 253, .97)',
                boxShadow: '0 22px 70px rgba(44, 92, 99, .2)',
                color: '#55767c',
                fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800 }}>Collection Tune</div>
              <div style={{ marginTop: 4, marginBottom: 14, fontSize: 14, color: '#839b9f' }}>{current.title}</div>

              {selectedSlot && selectedTune && selectedFaceTune ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7, marginBottom: 14 }}>
                    {current.slots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => selectSlot(slot)}
                        style={{
                          minHeight: 38,
                          border: selectedSlot.id === slot.id ? '2px solid #75aeb7' : '1px solid rgba(85,135,143,.22)',
                          borderRadius: 10,
                          background: selectedSlot.id === slot.id ? '#e2f2f3' : '#fff',
                          color: '#55767c',
                          cursor: 'pointer',
                        }}
                      >{slot.label}</button>
                    ))}
                  </div>

                  <TuneRow label="Left" value={selectedTune.x} min={0} max={90} step={0.1} suffix="%" onChange={(x) => updateSelectedSlot({ x })} />
                  <TuneRow label="Top" value={selectedTune.y} min={0} max={90} step={0.1} suffix="%" onChange={(y) => updateSelectedSlot({ y })} />
                  <TuneRow label="Width" value={selectedTune.width} min={5} max={60} step={0.1} suffix="%" onChange={(width) => updateSelectedSlot({ width })} />
                  <TuneRow label="Height" value={selectedTune.height} min={5} max={50} step={0.1} suffix="%" onChange={(height) => updateSelectedSlot({ height })} />

                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <button type="button" onClick={() => previewFace('front')}>正面</button>
                    <button type="button" disabled={!selectedSlot.back} onClick={() => previewFace('back')}>反面</button>
                  </div>
                  <TuneRow label="Scale" value={selectedFaceTune.scale} min={0.2} max={3} step={0.01} suffix="×" onChange={(scale) => updateSelectedFace({ scale })} />
                  <TuneRow label="Offset X" value={selectedFaceTune.offsetX} min={-100} max={100} step={0.5} suffix="%" onChange={(offsetX) => updateSelectedFace({ offsetX })} />
                  <TuneRow label="Offset Y" value={selectedFaceTune.offsetY} min={-100} max={100} step={0.5} suffix="%" onChange={(offsetY) => updateSelectedFace({ offsetY })} />
                </>
              ) : (
                <div style={{ padding: '18px 0', color: '#839b9f' }}>这张海报没有独立素材需要调参。</div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={saveTune}>保存参数</button>
                <button type="button" onClick={restoreTune}>恢复已保存</button>
                <button type="button" onClick={copyTune}>复制参数</button>
                <button type="button" onClick={resetTune}>重置默认</button>
              </div>

              <div style={{ marginTop: 10, minHeight: 20, fontSize: 13, color: dirty ? '#b77c70' : '#6f979d' }}>
                {dirty ? '● 有未保存修改' : '✓ 当前参数已保存'}{copyStatus ? ` · ${copyStatus}` : ''}
              </div>
            </aside>
          )}
        </div>
      )}
    </>
  )
}
