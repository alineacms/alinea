import react from '@vitejs/plugin-react'
import path from 'node:path'
import {defineConfig} from 'vite'
import {alineaFixturePlugin} from './src/v2/plugins/alineaFixturePlugin.js'

export default defineConfig({
  plugins: [alineaFixturePlugin(), react()],
  resolve: {
    tsconfigPaths: true
  },
  css: {
    modules: {
      generateScopedName(name, fileName, css) {
        const module = path.basename(fileName).split('.')[0]
        if (name.startsWith('root-')) name = name.slice(5)
        if (name.startsWith('root')) name = name.slice(4)
        return `alinea-${module}${name ? '-' + name : ''}`
      }
    }
  }
})
