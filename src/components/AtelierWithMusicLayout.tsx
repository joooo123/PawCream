import { useEffect } from 'react'
import AtelierWithMusic from './AtelierWithMusic'

type DeviceProfile = 'desktop' | 'mobile'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

const MUSIC_TUNE_STORAGE_KEY = 'pawcream-music-tune-v1'
const MUSIC_LAYOUT_SEED_KEY = 'pawcream-music-layout-seed-20260930-v2'

const FINAL_MUSIC_TUNE = {
  desktop: {
    coneX: 69.5,
    coneY: 43.5,
    coneWidth: 142,
    discScale: 25,
    discX: 48,
    discY: 42,
    fontBoost: 3,
  },
  mobile: {
    coneX: 76.5,
    coneY: 40.5,
    coneWidth: 171.5,
    discScale: 27,
    discX: 48,
    discY: 40.5,
    fontBoost: 5,
  },
} as const

function seedMusicTuneOnce() {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem(MUSIC_LAYOUT_SEED_KEY) === '1') return

  window.localStorage.setItem(MUSIC_TUNE_STORAGE_KEY, JSON.stringify(FINAL_MUSIC_TUNE))
  window.localStorage.setItem(MUSIC_LAYOUT_SEED_KEY, '1')
}

function useConeFrontFlightMask() {
  useEffect(() => {
    let mask: HTMLImageElement | null = null
    let frame = 0

    const removeMask = () => {
      if (!mask) return
      mask.remove()
      mask = null
    }

    const syncMask = () => {
      const overlay = document.querySelector<HTMLElement>('.pawcream-music-overlay')
      if (!overlay) {
        removeMask()
        return
      }

      const flyingDiscs = Array.from(overlay.querySelectorAll<HTMLImageElement>('img')).filter((image) => {
        const src = image.getAttribute('src') || ''
        return image.style.position === 'fixed' && src.includes('/assets/music%20player/cd')
      })

      if (flyingDiscs.length === 0) {
        removeMask()
        return
      }

      const front = Array.from(overlay.querySelectorAll<HTMLImageElement>('img')).find((image) =>
        (image.getAttribute('src') || '').includes('icecream%20front.png'),
      )
      if (!front) return

      const rect = front.getBoundingClientRect()
      if (!mask) {
        mask = front.cloneNode(false) as HTMLImageElement
        mask.className = 'pawcream-music-flight-front-mask'
        mask.alt = ''
        mask.setAttribute('aria-hidden', 'true')
        mask.draggable = false
        overlay.appendChild(mask)
      }

      Object.assign(mask.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        objectFit: 'contain',
        zIndex: '122',
        pointerEvents: 'none',
        userSelect: 'none',
        filter: 'none',
      })
    }

    const scheduleSync = () => {
      if (frame) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = 0
        syncMask()
      })
    }

    const observer = new MutationObserver(scheduleSync)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', scheduleSync)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', scheduleSync)
      if (frame) window.cancelAnimationFrame(frame)
      removeMask()
    }
  }, [])
}

export default function AtelierWithMusicLayout(props: Props) {
  // Seed before the child initializes so its localStorage-backed tune state starts
  // from the approved desktop/mobile values. The version marker prevents later
  // manual tuning from being overwritten on refresh.
  seedMusicTuneOnce()
  useConeFrontFlightMask()

  const mobile = props.deviceProfile === 'mobile'

  return (
    <>
      {mobile && (
        <style>{`
          /* Mobile Music: keep the artwork at its tuned size and crop overflow
             at the frosted panel edge instead of shrinking the assets. */
          .pawcream-music-panel {
            overflow: hidden !important;
          }

          /* Keep the 3x3 cabinet at its existing size, but anchor it higher
             inside the panel so all nine slots are visible without scrolling. */
          .pawcream-music-panel > div > aside {
            position: absolute !important;
            left: 13px !important;
            right: 13px !important;
            bottom: 12px !important;
            width: auto !important;
            max-width: none !important;
            margin: 0 !important;
            z-index: 6 !important;
          }
        `}</style>
      )}

      <AtelierWithMusic {...props} />
    </>
  )
}
