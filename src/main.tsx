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

// Public assets keep their filename on GitHub Pages, so replacing a PNG in-place
// can leave browsers/CDNs serving the previous cached bytes. Pin Note to the
// current blob version so the latest uploaded artwork is requested immediately.
const NOTE_ASSET_VERSION = '517196166abc61e4216196dc5b317b39c36d2c86'
const noteAssetUrl = `${import.meta.env.BASE_URL}assets/atelier/note.png?v=${NOTE_ASSET_VERSION}`
const absoluteNoteAssetUrl = new URL(noteAssetUrl, window.location.href).href

const refreshNoteAsset = () => {
  document.querySelectorAll<HTMLImageElement>('img[alt="Note"]').forEach((image) => {
    if (image.src !== absoluteNoteAssetUrl) image.src = noteAssetUrl
  })
}

const root = document.getElementById('root')!
const noteObserver = new MutationObserver(refreshNoteAsset)
noteObserver.observe(root, { childList: true, subtree: true })

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

refreshNoteAsset()
