import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss()
  ],
  server: {
    host: true,
    proxy: {
      '/api/xone-v1': {
        target: 'https://api-nartinvest.my.id',
        // target: 'http://localhost:8080',
        changeOrigin: true,
        secure: true, // Enable SSL verification for production
      },
      '/api/kurasi-v1': {
        target: 'https://api-nartinvest.my.id',
        // target: 'http://localhost:8080',
        changeOrigin: true,
        secure: true, // Enable SSL verification for production
      },
      '/api/chart': {
      	target: 'https://api-nartinvest.my.id',
        // target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/api/news': {
      	target: 'https://api-nartinvest.my.id',
        // target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'ui-vendor': ['lucide-vue-next', 'marked', 'highlight.js']
        }
      }
    }
  }
})
