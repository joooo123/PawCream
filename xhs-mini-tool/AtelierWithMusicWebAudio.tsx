import { useEffect } from 'react'
import AtelierWithMusicReturn from './AtelierWithMusicReturn'

type DeviceProfile = 'desktop' | 'mobile'
type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

// Nine original, short note patterns. No recordings, MP3 files or media URLs.
const MELODIES = [
  [0, 4, 7, 12, 7, 4, 2, 0],
  [0, 3, 7, 10, 7, 5, 3, 0],
  [0, 5, 9, 12, 9, 7, 5, 2],
  [0, 2, 5, 9, 7, 5, 2, -3],
  [0, 4, 9, 7, 4, 2, 7, 0],
  [0, 3, 5, 10, 8, 5, 3, 0],
  [0, 7, 5, 4, 2, 4, 7, 12],
  [0, 5, 7, 11, 7, 5, 4, 0],
  [0, 2, 7, 9, 7, 4, 2, 0],
] as const
const NOTE_SECONDS = 0.38

function currentDiscIndex() {
  const disc = document.querySelector<HTMLImageElement>('.pawcream-music-current-disc')
  const match = disc?.alt.match(/^CD\s+(\d+)$/i)
  const index = match ? Number(match[1]) - 1 : -1
  return index >= 0 && index < MELODIES.length ? index : null
}

function makeMelody(context: AudioContext, index: number) {
  const notes = MELODIES[index]
  const rate = context.sampleRate
  const frames = Math.round(rate * notes.length * NOTE_SECONDS)
  const buffer = context.createBuffer(1, frames, rate)
  const samples = buffer.getChannelData(0)
  const base = 220 * Math.pow(2, (index % 5) / 12)
  const frequencies = notes.map(offset => base * Math.pow(2, offset / 12))
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate
    const note = Math.min(notes.length - 1, Math.floor(t / NOTE_SECONDS))
    const local = t - note * NOTE_SECONDS
    const envelope = Math.min(1, local / 0.025, (NOTE_SECONDS - local) / 0.075)
    const frequency = frequencies[note]
    samples[i] = 0.14 * Math.max(0, envelope) * (
      Math.sin(2 * Math.PI * frequency * local) +
      0.2 * Math.sin(2 * Math.PI * frequency * 2 * local)
    )
  }
  return buffer
}

export default function AtelierWithMusicWebAudio(props: Props) {
  useEffect(() => {
    let context: AudioContext | null = null
    let source: AudioBufferSourceNode | null = null
    let closed = false

    const stop = () => {
      if (source) {
        try { source.stop() } catch { /* already stopped */ }
        source.disconnect()
        source = null
      }
      document.documentElement.dataset.pawcreamAudioState = 'stopped'
      delete document.documentElement.dataset.pawcreamAudioDisc
    }

    const resetSpoon = () => {
      window.requestAnimationFrame(() => {
        const button = document.querySelector<HTMLButtonElement>(
          'section[aria-label="Current music disc"] button[aria-label="停止唱针动画"]'
        )
        button?.click()
      })
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target) return
      if (target.closest('.pawcream-music-slot-button') ||
          target.closest('[data-pawcream-current-disc-return="1"]')) {
        stop()
        return
      }
      if (target.closest('section[aria-label="Current music disc"] button[aria-label="停止唱针动画"]')) {
        stop()
        return
      }
      if (!target.closest('section[aria-label="Current music disc"] button[aria-label="旋转唱针"]')) return

      const index = currentDiscIndex()
      if (index === null) return
      try {
        const Ctor = window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) throw new Error('AudioContext is unavailable')
        if (!context) context = new Ctor()
        stop()
        const next = context.createBufferSource()
        next.buffer = makeMelody(context, index)
        next.loop = true
        next.connect(context.destination)
        next.start()
        source = next
        document.documentElement.dataset.pawcreamAudioState = 'playing'
        document.documentElement.dataset.pawcreamAudioDisc = String(index + 1)
        void context.resume().catch(() => {
          if (!closed && source === next) {
            stop()
            resetSpoon()
          }
        })
      } catch {
        stop()
        resetSpoon()
      }
    }

    const syncDisc = () => {
      if (!document.querySelector('.pawcream-music-current-disc')) stop()
    }
    const observer = new MutationObserver(syncDisc)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('click', onClick, true)
    document.documentElement.dataset.pawcreamAudioState = 'stopped'
    return () => {
      closed = true
      observer.disconnect()
      document.removeEventListener('click', onClick, true)
      stop()
      delete document.documentElement.dataset.pawcreamAudioState
      if (context) void context.close().catch(() => {})
    }
  }, [])
  return <AtelierWithMusicReturn {...props} />
}
