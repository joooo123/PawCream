import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './atelierBackground.css'

const atelierBackgroundUrl = `${import.meta.env.BASE_URL}assets/atelier/background.png`
document.documentElement.style.setProperty(
  '--atelier-background-image',
  `url("${atelierBackgroundUrl}")`,
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
