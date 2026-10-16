import { useEffect } from 'react'
import AtelierWithMusicReturn from './AtelierWithMusicReturn'

type DeviceProfile = 'desktop' | 'mobile'
type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

// Stylistic moods only: nine newly composed phrases with distinct tempo,
 // harmony, instrumental colour, and groove. No samples or melodies from
 // commercially released recordings are reproduced.
 type Mood = {
   name: string
   bpm: number
   tonic: number
   lead: (number | null)[]
   chords: number[][]
   bass: number[]
   tone: [number, number]
   leadLevel: number
   padLevel: number
   bassLevel: number
   drums: [number, number, number]
   kicks: number[]
   snares: number[]
   hats: number[]
 }
 const MOODS: Mood[] = [
   { name:'糖果流行', bpm:110, tonic:62,
     lead:[0,4,7,null,9,7,4,2,5,9,12,9,7,4,2,0],
     chords:[[0,4,7],[5,9,12],[7,11,14],[2,5,9]],bass:[-12,-7,-5,-10],
     tone:[0.48,0.22],leadLevel:0.15,padLevel:0.034,bassLevel:0.085,drums:[0.18,0.07,0.04],
     kicks:[0,4,8,12],snares:[2,6,10,14],hats:[0,2,4,6,8,10,12,14]},
   { name:'轻盈电子', bpm:96, tonic:60,
     lead:[7,null,12,10,7,5,null,3,0,3,7,null,10,7,5,null],
     chords:[[0,3,7],[8,12,15],[5,8,12],[7,10,14]],bass:[-12,-4,-7,-5],
     tone:[0.24,0.08],leadLevel:0.13,padLevel:0.060,bassLevel:0.075,drums:[0.08,0.035,0.018],
     kicks:[0,8],snares:[6,14],hats:[2,6,10,14]},
   { name:'缓拍梦境', bpm:77, tonic:57,
     lead:[0,null,3,7,null,10,7,null,5,3,null,0,2,null,-2,null],
     chords:[[0,3,7],[-2,2,5],[5,8,12],[3,7,10]],bass:[-12,-14,-7,-9],
     tone:[0.16,0.04],leadLevel:0.12,padLevel:0.056,bassLevel:0.095,drums:[0.11,0.045,0.024],
     kicks:[0,7,8],snares:[4,12],hats:[0,3,6,9,12,15]},
   { name:'独立民谣', bpm:82, tonic:60,
     lead:[0,7,4,2,5,9,7,4,2,7,5,4,0,null,-3,0],
     chords:[[0,4,7],[-3,0,4],[5,9,12],[7,11,14]],bass:[-12,-15,-7,-5],
     tone:[0.33,0.13],leadLevel:0.16,padLevel:0.018,bassLevel:0.060,drums:[0.018,0,0.012],
     kicks:[0,8],snares:[],hats:[2,6,10,14]},
   { name:'柔和律动', bpm:104, tonic:58,
     lead:[7,null,5,3,null,7,10,null,5,3,null,0,3,7,null,2],
     chords:[[0,3,7],[5,8,12],[3,7,10],[7,10,14]],bass:[-12,-7,-9,-5],
     tone:[0.13,0.04],leadLevel:0.12,padLevel:0.040,bassLevel:0.120,drums:[0.13,0.10,0.038],
     kicks:[0,3,8,11],snares:[4,12],hats:[0,2,5,6,8,10,13,14]},
   { name:'俏皮节拍', bpm:124, tonic:61,
     lead:[0,7,null,5,9,null,12,7,5,3,0,null,9,7,null,3],
     chords:[[0,4,7],[10,14,17],[5,9,12],[7,11,14]],bass:[-12,-2,-7,-5],
     tone:[0.62,0.31],leadLevel:0.135,padLevel:0.026,bassLevel:0.13,drums:[0.20,0.095,0.042],
     kicks:[0,4,7,8,12],snares:[4,12],hats:[0,2,4,6,8,10,12,14]},
   { name:'温柔木吉他', bpm:76, tonic:59,
     lead:[0,4,7,4,2,5,9,5,7,5,2,0,-2,2,4,null],
     chords:[[0,4,7],[5,9,12],[2,5,9],[-2,2,5]],bass:[-12,-7,-10,-14],
     tone:[0.38,0.17],leadLevel:0.145,padLevel:0.014,bassLevel:0.062,drums:[0.005,0,0],
     kicks:[0],snares:[],hats:[]},
   { name:'夏日海风', bpm:118, tonic:64,
     lead:[0,4,9,7,5,9,12,null,7,11,14,11,9,7,4,2],
     chords:[[0,4,7],[5,9,12],[9,12,16],[7,11,14]],bass:[-12,-7,-3,-5],
     tone:[0.58,0.25],leadLevel:0.15,padLevel:0.033,bassLevel:0.092,drums:[0.16,0.07,0.065],
     kicks:[0,4,8,12],snares:[4,12],hats:[0,2,4,6,8,10,12,14]},
   { name:'雨夜钢琴', bpm:70, tonic:60,
     lead:[0,null,7,4,null,9,7,null,5,null,3,0,2,null,-2,null],
     chords:[[0,3,7],[8,12,15],[5,8,12],[7,10,14]],bass:[-12,-4,-7,-5],
     tone:[0.23,0.10],leadLevel:0.12,padLevel:0.056,bassLevel:0.047,drums:[0,0,0],
     kicks:[],snares:[],hats:[]},
 ]
 const NOTE_COUNT = 16
 const tau = 2 * Math.PI
 const midi = (note: number) => 440 * Math.pow(2, (note - 69) / 12)
 const clickAt = (step: number, hits: number[]) => hits.indexOf(step) >= 0

 function currentDiscIndex() {
   const disc = document.querySelector<HTMLImageElement>('.pawcream-music-current-disc')
   const match = disc?.alt.match(/^CD\s+(\d+)$/i)
   const index = match ? Number(match[1]) - 1 : -1
   return index >= 0 && index < MOODS.length ? index : null
 }

 function makeMelody(context: AudioContext, index: number) {
   const style = MOODS[index]
   const stepSeconds = 30 / style.bpm
   const duration = NOTE_COUNT * stepSeconds
   const rate = context.sampleRate
   const frames = Math.ceil(rate * duration)
   const buffer = context.createBuffer(1, frames, rate)
   const samples = buffer.getChannelData(0)
   const melody = style.lead.map(n => n === null ? 0 : midi(style.tonic + n))
   const chords = style.chords.map(chord => chord.map(n => midi(style.tonic + n - 12)))
   const bass = style.bass.map(n => midi(style.tonic + n - 12))
   const kickMap = Array.from({length: NOTE_COUNT}, (_,step) => clickAt(step,style.kicks))
   const snareMap = Array.from({length: NOTE_COUNT}, (_,step) => clickAt(step,style.snares))
   const hatMap = Array.from({length: NOTE_COUNT}, (_,step) => clickAt(step,style.hats))

   // Render once into a small mono PCM buffer and loop the buffer. This mirrors
   // the AudioBuffer technique verified on the user's Android mini-tool.
   for (let i = 0; i < frames; i++) {
     const time = i / rate
     const step = Math.min(NOTE_COUNT - 1, Math.floor(time / stepSeconds))
     const local = time - step * stepSeconds
     const chordIndex = Math.floor(step / 4)
     const chordLocal = time - chordIndex * 4 * stepSeconds
     const phraseFade = Math.max(0, Math.min(1, time / 0.05, (duration - time) / 0.075))
     let lead = 0
     if (melody[step]) {
       const phase = tau * melody[step] * local
       const attack = Math.min(1, local / 0.017)
       const decay = Math.pow(Math.max(0, 1 - local / stepSeconds), index === 3 || index === 6 ? 2.0 : 1.35)
       lead = (Math.sin(phase) + style.tone[0] * Math.sin(2 * phase) +
         style.tone[1] * Math.sin(3 * phase)) * attack * decay * style.leadLevel
     }
     const chordFade = Math.max(0, Math.min(1, chordLocal / 0.12, (4 * stepSeconds - chordLocal) / 0.16))
     let pad = 0
     for (let n = 0; n < 3; n++) {
       const phase = tau * chords[chordIndex][n] * chordLocal
       pad += Math.sin(phase) + 0.16 * Math.sin(2 * phase)
     }
     pad *= style.padLevel * chordFade / 3
     const bassTime = time - Math.floor(step / 4) * 4 * stepSeconds
     const bassEnv = Math.exp(-bassTime * (index === 4 || index === 5 ? 1.9 : 1.2))
     const bassWave = (Math.sin(tau * bass[chordIndex] * bassTime) +
       0.14 * Math.sin(2 * tau * bass[chordIndex] * bassTime)) * style.bassLevel * bassEnv

     // Deterministic low-volume percussion, without audio samples.
     const noise = Math.sin(i * 0.719 + Math.sin(i * 0.173) * 7.3)
     const kick = kickMap[step] ? Math.sin(tau * (93 - 55 * Math.min(1, local / 0.16)) * local) *
       Math.exp(-local * 27) * style.drums[0] : 0
     const snare = snareMap[step] ? noise * Math.exp(-local * 33) * style.drums[1] : 0
     const hat = hatMap[step] ? noise * Math.exp(-local * 75) * style.drums[2] : 0
     samples[i] = Math.max(-0.85, Math.min(0.85,
       (lead + pad + bassWave + kick + snare + hat) * phraseFade))
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
      delete document.documentElement.dataset.pawcreamAudioMood
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
        document.documentElement.dataset.pawcreamAudioMood = MOODS[index].name
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
