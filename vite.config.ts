import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Local development stays at `/`; GitHub Pages serves this project at `/PawCream/`.
  base: command === 'build' ? '/PawCream/' : '/',
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
}))
