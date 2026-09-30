import { useEffect, useRef } from 'react'
import AtelierWithMusicSpoonPreview from './AtelierWithMusicSpoonPreview'

type DeviceProfile = 'desktop' | 'mobile'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

const RETURN_DURATION_MS = 560
const RETURN_TARGET_ATTR = 'data-pawcream-current-disc-return'

export default function AtelierWithMusicReturn(props: Props) {
  const returningRef = useRef(false)
  const flightRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    let decoratedTarget: HTMLElement | null = null

    const clearTarget = () => {
      if (!decoratedTarget) return
      decoratedTarget.removeAttribute(RETURN_TARGET_ATTR)
      decoratedTarget.removeAttribute('role')
      decoratedTarget.removeAttribute('tabindex')
      decoratedTarget.removeAttribute('aria-label')
      decoratedTarget.style.pointerEvents = 'none'
      decoratedTarget.style.cursor = ''
      decoratedTarget = null
    }

    const syncTarget = () => {
      const disc = document.querySelector<HTMLImageElement>('.pawcream-music-current-disc')
      const nextTarget = disc?.parentElement as HTMLElement | null

      if (nextTarget === decoratedTarget) return
      clearTarget()
      if (!nextTarget) return

      decoratedTarget = nextTarget
      decoratedTarget.setAttribute(RETURN_TARGET_ATTR, '1')
      decoratedTarget.setAttribute('role', 'button')
      decoratedTarget.setAttribute('tabindex', '0')
      decoratedTarget.setAttribute('aria-label', 'Return current CD to display')
      decoratedTarget.style.pointerEvents = 'auto'
      decoratedTarget.style.cursor = 'pointer'
    }

    const returnCurrentDisc = async () => {
      if (returningRef.current) return

      const currentDisc = document.querySelector<HTMLImageElement>('.pawcream-music-current-disc')
      const selectedButton = document.querySelector<HTMLButtonElement>('.pawcream-music-slot-button[aria-pressed="true"]')
      const selectedSlot = selectedButton?.firstElementChild as HTMLElement | null
      const overlay = document.querySelector<HTMLElement>('.pawcream-music-overlay')
      if (!currentDisc || !selectedSlot || !overlay) return

      const source = currentDisc.getBoundingClientRect()
      const destination = selectedSlot.getBoundingClientRect()
      if (!source.width || !destination.width) return

      returningRef.current = true

      const pauseButton = document.querySelector<HTMLButtonElement>(
        'section[aria-label="Current music disc"] button[aria-label="Pause music"]',
      )
      pauseButton?.click()

      currentDisc.style.opacity = '0'
      if (decoratedTarget) decoratedTarget.style.pointerEvents = 'none'

      const flight = currentDisc.cloneNode(false) as HTMLImageElement
      flightRef.current = flight
      flight.className = 'pawcream-music-return-flight'
      flight.alt = ''
      flight.setAttribute('aria-hidden', 'true')
      flight.draggable = false
      Object.assign(flight.style, {
        position: 'fixed',
        left: `${source.left}px`,
        top: `${source.top}px`,
        width: `${source.width}px`,
        height: `${source.height}px`,
        objectFit: 'contain',
        zIndex: '121',
        pointerEvents: 'none',
        userSelect: 'none',
        opacity: '1',
      })
      overlay.appendChild(flight)

      const animation = flight.animate(
        [
          {
            left: `${source.left}px`,
            top: `${source.top}px`,
            width: `${source.width}px`,
            height: `${source.height}px`,
            transform: 'rotate(0deg) scale(1)',
            opacity: 1,
          },
          {
            left: `${destination.left}px`,
            top: `${destination.top}px`,
            width: `${destination.width}px`,
            height: `${destination.height}px`,
            transform: 'rotate(-28deg) scale(.98)',
            opacity: 1,
          },
        ],
        {
          duration: RETURN_DURATION_MS,
          easing: 'cubic-bezier(.2,.78,.2,1)',
          fill: 'forwards',
        },
      )

      try {
        await animation.finished
      } catch {
        // The overlay may be closed while the return animation is running.
      }

      const musicControl = document.querySelector<HTMLElement>('[aria-label="Music interaction"]')
      if (musicControl?.isConnected) {
        musicControl.click()
        window.requestAnimationFrame(() => {
          flight.remove()
          if (flightRef.current === flight) flightRef.current = null
          returningRef.current = false
          syncTarget()
        })
      } else {
        currentDisc.style.opacity = ''
        flight.remove()
        if (flightRef.current === flight) flightRef.current = null
        returningRef.current = false
        syncTarget()
      }
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target?.closest(`[${RETURN_TARGET_ATTR}="1"]`)) return
      event.preventDefault()
      event.stopPropagation()
      void returnCurrentDisc()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const target = event.target as Element | null
      if (!target?.closest(`[${RETURN_TARGET_ATTR}="1"]`)) return
      event.preventDefault()
      event.stopPropagation()
      void returnCurrentDisc()
    }

    syncTarget()
    const observer = new MutationObserver(syncTarget)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      observer.disconnect()
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKeyDown, true)
      clearTarget()
      flightRef.current?.remove()
      flightRef.current = null
      returningRef.current = false
    }
  }, [])

  return <AtelierWithMusicSpoonPreview {...props} />
}
