import {BuildOptions} from 'esbuild'
import {LiveReload} from './LiveReload.js'

export interface ServeContext {
  rootDir: string
  staticDir: string
  alineaDev: boolean
  buildOptions: BuildOptions
  production: boolean
  liveReload: LiveReload
}
