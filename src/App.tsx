import { useState } from 'react'
import HomeScene from './components/HomeScene'
import P5PathLayer from './components/P5PathLayer'
import AtelierPlaceholder from './components/AtelierPlaceholder'

export default function App() {
  const [scene, setScene] = useState<'home' | 'atelier'>('home')

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
