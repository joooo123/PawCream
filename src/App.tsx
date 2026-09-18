import { useState } from 'react'
import HomeScene from './components/HomeScene'
import P5PathLayer from './components/P5PathLayer'
import AtelierPlaceholder from './components/AtelierPlaceholder'

function getInitialScene(): 'home' | 'atelier' {
  if (typeof window === 'undefined') return 'home'
  return new URLSearchParams(window.location.search).get('scene') === 'atelier'
    ? 'atelier'
    : 'home'
}

export default function App() {
  const [scene, setScene] = useState<'home' | 'atelier'>(() => getInitialScene())

  if (scene === 'atelier') {
    return <AtelierPlaceholder onBack={() => setScene('home')} />
  }

  return (
    <>
      <HomeScene onEnter={() => setScene('atelier')} />
      <P5PathLayer />
    </>
  )
}
