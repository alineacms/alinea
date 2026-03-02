import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import {alineaFixturePlugin} from './plugins/alineaFixturePlugin'

export default defineConfig({
  plugins: [alineaFixturePlugin(), tsconfigPaths(), react()]
})
