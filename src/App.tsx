import { useEffect, useMemo, useState } from 'react'
import HomeScene from './components/HomeScene'
import AtelierPlaceholder from './components/AtelierWithMusicAudio'
import { ASSETS } from './sceneConfig'

export type DeviceProfile = 'desktop' | 'mobile'

function getInitialScene(): 'home' | 'atelier' {
  if (typeof window === 'undefined') return 'home'
  return new URLSearchParams(window.location.search).get('scene') === 'atelier'
    ? 'atelier'
    : 'home'
}

function getForcedDevice(): DeviceProfile | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('device')
  return value === 'desktop' || value === 'mobile' ? value : null
}

function getDetectedDevice(): DeviceProfile {
  if (typeof window === 'undefined') return 'desktop'
  return window.matchMedia('(max-width: 700px)').matches ? 'mobile' : 'desktop'
}

function warmImage(src: string) {
  const image = new Image()
  image.decoding = 'async'
  image.src = src
}

export default function App() {
  const [scene, setScene] = useState<'home' | 'atelier'>(() => getInitialScene())
  const tuneMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tune') === '1',
    [],
  )
  const initialForcedDevice = useMemo(() => getForcedDevice(), [])
  const [detectedDevice, setDetectedDevice] = useState<DeviceProfile>(() => getDetectedDevice())
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile>(
    () => getForcedDevice() ?? getDetectedDevice(),
  )

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)')
    const update = () => {
      const detected: DeviceProfile = media.matches ? 'mobile' : 'desktop'
      setDetectedDevice(detected)
      if (!tuneMode && !initialForcedDevice) {
        setDeviceProfile(detected)
      }
    }

    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [initialForcedDevice, tuneMode])

  useEffect(() => {
    if (scene !== 'atelier' || typeof window === 'undefined') return

    // Warm the resources that make Home feel instant before the user asks to return.
    const firstWave = [ASSETS.homeMobile, ASSETS.ecg, ...ASSETS.stars.slice(0, 3)]
    firstWave.forEach(warmImage)

    const timers = ASSETS.stars.slice(3).map((src, index) =>
      window.setTimeout(() => warmImage(src), 450 + index * 110),
    )

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [scene])

  const switchDevice = (profile: DeviceProfile) => {
    setDeviceProfile(profile)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('device', profile)
    window.history.replaceState(null, '', url)
  }

  const enterAtelier = () => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('pawcream-entering-atelier')
      window.setTimeout(() => {
        document.documentElement.classList.remove('pawcream-entering-atelier')
      }, 760)
    }

    setScene('atelier')
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('scene', 'atelier')
    window.history.replaceState(null, '', url)
  }

  const returnHome = () => {
    setScene('home')
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.delete('scene')
    url.searchParams.delete('tune')
    window.history.replaceState(null, '', url)
  }

  const mobile = deviceProfile === 'mobile'
  const mobilePreview = tuneMode && mobile && detectedDevice === 'desktop'

  if (scene === 'atelier') {
    return (
      <AtelierPlaceholder
        onBack={returnHome}
        deviceProfile={deviceProfile}
        onDeviceChange={switchDevice}
        mobilePreview={mobilePreview}
      />
    )
  }

  return (
    <HomeScene
      key={`home-${deviceProfile}`}
      mobile={mobile}
      mobilePreview={mobilePreview}
      deviceProfile={deviceProfile}
      onDeviceChange={switchDevice}
      onEnter={enterAtelier}
    />
  )
}
