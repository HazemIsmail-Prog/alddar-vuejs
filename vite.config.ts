import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: '@unovis/ts',
        replacement: fileURLToPath(new URL('./node_modules/@unovis/ts', import.meta.url)),
      },
      {
        find: '@unovis/vue',
        replacement: fileURLToPath(new URL('./node_modules/@unovis/vue', import.meta.url)),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  optimizeDeps: {
    include: ['@unovis/ts', '@unovis/vue'],
  },
  server: {
    port: 5173,
  },
})
