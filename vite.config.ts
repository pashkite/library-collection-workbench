import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/library-collection-workbench/',
  cacheDir: '/tmp/library-collection-workbench-vite-cache',
  plugins: [react()],
  build: {
    cssMinify: false,
  },
})
