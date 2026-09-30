import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AtelierWithMusicLayout from './AtelierWithMusicLayout'

type DeviceProfile = 'desktop' | 'mobile'
type PreviewPose = 'start' | 'end'

type Props = {
  onBack: () => void
  deviceProfile: DeviceProfile
  onDeviceChange: (profile: DeviceProfile) => void
  mobilePreview: boolean
}

type SpoonTune = {
  startX: number
  startY: number
  startRotation: number
  endX: number
  endY: number
  endRotation: number
  scale: number
}

const SPOON_TUNE_STORAGE_KEY = 'pawcream-music-spoon-tune-v1'

function readSpoonTune(profile: DeviceProfile): SpoonTune | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SPOON_TUNE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Record<DeviceProfile, SpoonTune>>
    return parsed[profile] ?? null
  } catch {
    return null
  }
}

function findSpoonButton() {
  return document.querySelector<HTMLButtonElement>(
    'section[aria-label="Current music disc"] button[aria-label="Play music"], section[aria-label="Current music disc"] button[aria-label="Pause music"]',
  )
}

function applyPreview(profile: DeviceProfile, pose: PreviewPose) {
  const tune = readSpoonTune(profile)
  const spoon = findSpoonButton()
  if (!tune || !spoon) return

  const x = pose === 'end' ? tune.endX : tune.startX
  const y = pose === 'end' ? tune.endY : tune.startY
  const rotation = pose === 'end' ? tune.endRotation : tune.startRotation

  spoon.style.left = `${x}%`
  spoon.style.top = `${y}%`
  spoon.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`
}

export default function AtelierWithMusicSpoonPreview(props: Props) {
  const [previewPose, setPreviewPose] = useState<PreviewPose>('start')
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const syncPanel = () => {
      const next = document.querySelector<HTMLElement>('aside[aria-label="PawCream Music tune panel"]')
      setPanelHost((current) => current === next ? current : next)
    }

    syncPanel()
    const observer = new MutationObserver(syncPanel)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => applyPreview(props.deviceProfile, previewPose))
    return () => window.cancelAnimationFrame(frame)
  }, [props.deviceProfile, previewPose, panelHost])

  useEffect(() => {
    const onInput = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement) || target.type !== 'range') return
      if (!target.closest('aside[aria-label="PawCream Music tune panel"]')) return

      const label = target.closest('label')?.textContent ?? ''
      let pose: PreviewPose | null = null
      if (label.includes('终点')) pose = 'end'
      else if (label.includes('起点')) pose = 'start'
      else if (label.includes('勺子大小')) pose = previewPose
      if (!pose) return

      setPreviewPose(pose)
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => applyPreview(props.deviceProfile, pose!))
      })
    }

    document.addEventListener('input', onInput)
    return () => document.removeEventListener('input', onInput)
  }, [previewPose, props.deviceProfile])

  const showPose = (pose: PreviewPose) => {
    setPreviewPose(pose)
    window.requestAnimationFrame(() => applyPreview(props.deviceProfile, pose))
  }

  return (
    <>
      <AtelierWithMusicLayout {...props} />

      {panelHost && createPortal(
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid rgba(217,154,179,.24)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 7, color: '#8a7080' }}>
            勺子位置预览
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {(['start', 'end'] as PreviewPose[]).map((pose) => {
              const active = previewPose === pose
              return (
                <button
                  key={pose}
                  type="button"
                  onClick={() => showPose(pose)}
                  style={{
                    minHeight: 32,
                    border: '1px solid rgba(217,154,179,.46)',
                    borderRadius: 10,
                    background: active ? 'rgba(247,214,228,.96)' : 'rgba(255,255,255,.72)',
                    color: active ? '#b76487' : '#876d7d',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {pose === 'start' ? '预览起点' : '预览终点'}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, lineHeight: 1.45, color: '#9a7f8e' }}>
            拖动起点或终点滑块时，会自动切换到对应位置实时预览。
          </div>
        </div>,
        panelHost,
      )}
    </>
  )
}
