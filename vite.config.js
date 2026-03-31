import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/chip-741/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    open: true,
    headers: {
      'Cache-Control': 'no-store',
    },
  },
})
