import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'
import {alineaFixturePlugin} from './plugins/alineaFixturePlugin'

export default defineConfig({
  plugins: [alineaFixturePlugin(), react()],
  resolve: {
    tsconfigPaths: true
  }
})
