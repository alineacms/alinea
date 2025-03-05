import {BuildOptions} from 'esbuild'
import {LiveReload} from './LiveReload.js'

export interface ServeContext {
  cmd: 'dev' | 'build'
  configLocation: string
  rootDir: string
  base: string | undefined
  staticDir: string
  alineaDev: boolean
  buildOptions: BuildOptions
  production: boolean
  liveReload: LiveReload
}
