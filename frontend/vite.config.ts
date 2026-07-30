import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcjs from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcjs()],
  resolve: {
    // `@` -> src, so themes (and app code) import shared types by a stable, location-independent
    // path — e.g. `import type { PageConfig } from '@/views/front/theme-runtime'`.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    // Resolve modules through the symlink path, not the realpath. Lets the dev "active theme"
    // slot (src/views/front/templates) be a symlink into ../../frontend_themes/<theme> while
    // bare imports (vue, vue-router, ...) still resolve against frontend/node_modules.
    // No effect on the plain-directory slot Docker COPYs in prod. See docs/frontend.md.
    preserveSymlinks: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        //rewrite: (path) => path.replace(/^\/api/, '')
      },
      "/static": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  }
})
