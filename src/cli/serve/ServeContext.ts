import type {BuildOptions} from 'esbuild'
import type {LiveReload} from './LiveReload.js'

export interface ServeContext {
  cmd: 'dev' | 'build'
  configLocation: string
  rootDir: string
  staticDir: string
  alineaDev: boolean
  buildOptions: BuildOptions
  production: boolean
  liveReload: LiveReload
  buildId: string
  apiKey: string
}
