import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  // GitHub Pages uses /PawCream/. The Gitea/Nginx build is served from the IP root path.
  base: command === 'build' ? (mode === 'gitea' ? '/' : '/PawCream/') : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
}))
