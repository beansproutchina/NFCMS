import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcjs from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcjs()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        //rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
