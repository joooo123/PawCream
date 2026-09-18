import { useEffect, useMemo, useState } from 'react'
import HomeScene from './components/HomeScene'
import P5PathLayer from './components/P5PathLayer'
import AtelierPlaceholder from './components/AtelierPlaceholder'

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

  const switchDevice = (profile: DeviceProfile) => {
    setDeviceProfile(profile)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('device', profile)
    window.history.replaceState(null, '', url)
  }

  const mobile = deviceProfile === 'mobile'
  const mobilePreview = tuneMode && mobile && detectedDevice === 'desktop'

  if (scene === 'atelier') {
    return (
      <AtelierPlaceholder
        onBack={() => setScene('home')}
        deviceProfile={deviceProfile}
        onDeviceChange={switchDevice}
        mobilePreview={mobilePreview}
      />
    )
  }

  return (
    <>
      <HomeScene
        key={`home-${deviceProfile}`}
        mobile={mobile}
        mobilePreview={mobilePreview}
        deviceProfile={deviceProfile}
        onDeviceChange={switchDevice}
        onEnter={() => setScene('atelier')}
      />
      {!mobile && <P5PathLayer />}
    </>
  )
}
