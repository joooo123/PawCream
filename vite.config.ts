import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const atelierAssetNames = [
  'background.png',
  'background2.png',
  'background3.png',
  'background4.png',
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

const replaceAllText = (source: string, from: string, to: string) =>
  source.split(from).join(to)

function atelierTuningDefaults() {
  const replacements = [
    ['music: L(37, 40.7, 38, 0)', 'music: L(35.5, 34.8, 38, 0)'],
    ['color: L(81.5, 16.5, 30, -89)', 'color: L(80.2, 17.3, 30, -89)'],
    ['music: L(35.5, 36.3, 93.5, 0)', 'music: L(25.4, 32.5, 93.5, 0)'],
    ['color: L(84, 36.5, 83, -89)', 'color: L(82.1, 36.6, 83, -89)'],
  ] as const

  return {
    name: 'atelier-tuning-defaults',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (id.indexOf('/src/components/AtelierPlaceholderV2.tsx') === -1) return null

      let next = code
      for (const [from, to] of replacements) next = replaceAllText(next, from, to)
      return next === code ? null : { code: next, map: null }
    },
  }
}

function atelierWebpReferences() {
  return {
    name: 'atelier-webp-references',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (id.indexOf('/src/') === -1) return null

      let next = code
      for (const pngName of atelierAssetNames) {
        const webpName = pngName.replace(/\.png$/i, '.webp')
        next = replaceAllText(next, pngName, webpName)
        next = replaceAllText(
          next,
          pngName.split(' ').join('%20'),
          webpName.split(' ').join('%20'),
        )
      }

      return next === code ? null : { code: next, map: null }
    },
  }
}

export default defineConfig(({ command, mode }) => ({
  plugins: [
    atelierTuningDefaults(),
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
