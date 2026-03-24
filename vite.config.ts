import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'
import {alineaFixturePlugin} from './src/v2/plugins/alineaFixturePlugin.js'

export default defineConfig({
  plugins: [alineaFixturePlugin(), react()],
  resolve: {
    tsconfigPaths: true
  }
})
