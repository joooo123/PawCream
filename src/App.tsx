import { useEffect, useMemo, useState } from 'react'
import HomeScene from './components/HomeScene'
import P5PathLayer from './components/P5PathLayer'
import AtelierPlaceholder from './components/AtelierPlaceholder'

function getInitialScene(): 'home' | 'atelier' {
  if (typeof window === 'undefined') return 'home'
  return new URLSearchParams(window.location.search).get('scene') === 'atelier'
    ? 'atelier'
    : 'home'
}

function getForcedDevice(): 'desktop' | 'mobile' | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('device')
  return value === 'desktop' || value === 'mobile' ? value : null
}

function getInitialMobile() {
  if (typeof window === 'undefined') return false
  const forced = getForcedDevice()
  if (forced) return forced === 'mobile'
  return window.matchMedia('(max-width: 700px)').matches
}

export default function App() {
  const [scene, setScene] = useState<'home' | 'atelier'>(() => getInitialScene())
  const forcedDevice = useMemo(() => getForcedDevice(), [])
  const [mobile, setMobile] = useState(() => getInitialMobile())

  useEffect(() => {
    if (forcedDevice) {
      setMobile(forcedDevice === 'mobile')
      return
    }

    const media = window.matchMedia('(max-width: 700px)')
    const update = () => setMobile(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [forcedDevice])

  if (scene === 'atelier') {
    return <AtelierPlaceholder onBack={() => setScene('home')} />
  }

  return (
    <>
      <HomeScene mobile={mobile} onEnter={() => setScene('atelier')} />
      {!mobile && <P5PathLayer />}
    </>
  )
}
