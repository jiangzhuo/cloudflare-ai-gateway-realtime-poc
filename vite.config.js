import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        chat: resolve(__dirname, 'src/pages/chat.html'),
        realtime: resolve(__dirname, 'src/pages/realtime.html'),
        realtimeDirect: resolve(__dirname, 'src/pages/realtime-direct.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
})