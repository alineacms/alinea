import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'

export interface GenerateContext {
  wasmCache: boolean
  cwd: string
  configLocation: string
  staticDir: string
  quiet: boolean
  store: SqliteStore
  outDir: string
  watch: boolean
  fix: boolean
}
