import { useEffect, useRef } from 'react'
import AtelierWithMusicReturn from './AtelierWithMusicReturn'

type DeviceProfile = 'desktop' | 'mobile'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

const BASE_URL = import.meta.env.BASE_URL
const AUDIO_VERSION = '20260930-1'
const musicTrack = (name: string) =>
  `${BASE_URL}assets/music%20player/${encodeURIComponent(name)}?v=${AUDIO_VERSION}`

// CD 1 is the top-left disc. Lucky is intentionally pinned there.
const TRACK_URLS = [
  musicTrack('Britney Spears - Lucky (Instrumental).mp3'),
  musicTrack('AK Akemi Kakihara - Blue Apple.mp3'),
  musicTrack('BlackDD - Time Stop.mp3'),
  musicTrack('Chance Peña - How Long, How Low_.mp3'),
  musicTrack('NewJeans - Ditto.mp3'),
  musicTrack('SOYEON - I’m gonna TOESA (Narr. KIAN84).mp3'),
  musicTrack('Sufjan Stevens - Mystery of Love.mp3'),
  musicTrack('aespa - BAHAMA.mp3'),
  musicTrack('春野杉卉 - 0.03秒的重逢.mp3'),
] as const

function readCurrentDiscIndex() {
  const disc = document.querySelector<HTMLImageElement>('.pawcream-music-current-disc')
  if (!disc) return null

  const altMatch = disc.alt.match(/^CD\s+(\d+)$/i)
  if (altMatch) {
    const index = Number(altMatch[1]) - 1
    return index >= 0 && index < TRACK_URLS.length ? index : null
  }

  const srcMatch = (disc.getAttribute('src') || '').match(/cd(\d+)\.png/i)
  if (!srcMatch) return null
  const index = Number(srcMatch[1]) - 1
  return index >= 0 && index < TRACK_URLS.length ? index : null
}

export default function AtelierWithMusicAudio(props: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackIndexRef = useRef<number | null>(null)

  useEffect(() => {
    const pauseAudio = () => {
      audioRef.current?.pause()
    }

    const stopAudio = () => {
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        try {
          audio.currentTime = 0
        } catch {
          // Some browsers can reject seeking before metadata has loaded.
        }
        audio.removeAttribute('src')
        audio.load()
      }
      audioRef.current = null
      trackIndexRef.current = null
    }

    const resetSpoonPlaybackState = () => {
      const pauseButton = document.querySelector<HTMLButtonElement>(
        'section[aria-label="Current music disc"] button[aria-label="Pause music"]',
      )
      pauseButton?.click()
    }

    const ensureAudio = (index: number) => {
      if (trackIndexRef.current === index && audioRef.current) return audioRef.current

      stopAudio()
      const audio = new Audio(TRACK_URLS[index])
      audio.preload = 'metadata'
      audio.volume = 1
      audio.onended = () => {
        try {
          audio.currentTime = 0
        } catch {
          // Ignore browsers that do not allow seeking here.
        }
        resetSpoonPlaybackState()
      }
      audio.onerror = () => {
        resetSpoonPlaybackState()
      }
      audioRef.current = audio
      trackIndexRef.current = index
      return audio
    }

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target) return

      if (target.closest('.pawcream-music-slot-button')) {
        stopAudio()
        return
      }

      if (target.closest('[data-pawcream-current-disc-return="1"]')) {
        stopAudio()
        return
      }

      const playButton = target.closest(
        'section[aria-label="Current music disc"] button[aria-label="Play music"]',
      )
      if (playButton) {
        const index = readCurrentDiscIndex()
        if (index === null) return

        const audio = ensureAudio(index)
        const playback = audio.play()
        if (playback) {
          void playback.catch(() => {
            window.requestAnimationFrame(resetSpoonPlaybackState)
          })
        }
        return
      }

      if (target.closest('section[aria-label="Current music disc"] button[aria-label="Pause music"]')) {
        pauseAudio()
      }
    }

    const syncDiscPresence = () => {
      if (!document.querySelector('.pawcream-music-current-disc')) {
        stopAudio()
      }
    }

    document.addEventListener('click', onClickCapture, true)
    const observer = new MutationObserver(syncDiscPresence)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      document.removeEventListener('click', onClickCapture, true)
      stopAudio()
    }
  }, [])

  return <AtelierWithMusicReturn {...props} />
}
