import {BuildOptions} from 'esbuild'
import {LiveReload} from './LiveReload.js'

export interface ServeContext {
  cwd: string
  staticDir: string
  alineaDev: boolean
  buildOptions: BuildOptions
  production: boolean
  liveReload: LiveReload
}
