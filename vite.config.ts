import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/library-collection-workbench/',
  cacheDir: '/tmp/library-collection-workbench-vite-cache',
  envPrefix: ['VITE_', 'ALADIN_'],
  plugins: [react()],
  build: {
    cssMinify: false,
  },
})
