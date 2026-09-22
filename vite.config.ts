import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const atelierAssetNames = [
  'background.png',
  'background2.png',
  'background3.png',
  'window.png',
  'pawcream.png',
  'wall-mounted cabinet.png',
  'people.png',
  'light.png',
  'lighton.png',
  'instax.png',
  'sewing machine.png',
  'bear.png',
  'music.png',
  'note.png',
  'message.png',
  'color.png',
]

function atelierWebpReferences() {
  return {
    name: 'atelier-webp-references',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.includes('/src/')) return null

      let next = code
      for (const pngName of atelierAssetNames) {
        const webpName = pngName.replace(/\.png$/i, '.webp')
        next = next.replaceAll(pngName, webpName)
        next = next.replaceAll(
          pngName.replaceAll(' ', '%20'),
          webpName.replaceAll(' ', '%20'),
        )
      }

      return next === code ? null : { code: next, map: null }
    },
  }
}

export default defineConfig(({ command, mode }) => ({
  plugins: [
    command === 'build' && mode === 'webp' ? atelierWebpReferences() : null,
    react(),
  ],
  // Local development stays at `/`; GitHub Pages serves this project at `/PawCream/`.
  base: command === 'build' ? '/PawCream/' : '/',
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
}))
