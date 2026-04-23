/*
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'がんばりボード',
        short_name: 'がんばりボード',
        description: 'こどものタスクかんりアプリ',
        theme_color: '#4f46e5',
        background_color: '#fef3c7',
        display: 'standalone',      // ← ブラウザUIを隠してアプリっぽくする
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
*/
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',   // ← Capacitor用に相対パスに変更
  build: {
    outDir: 'dist',
  },
})