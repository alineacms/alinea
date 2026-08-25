import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '#': fileURLToPath(new URL('../', import.meta.url))
    }
  },
  css: {modules: {generateScopedName: '[local]'}}
})
