export interface GenerateContext {
  cmd: 'dev' | 'build'
  wasmCache: boolean
  rootDir: string
  configLocation: string
  configDir: string
  staticDir: string
  quiet: boolean
  outDir: string
  fix: boolean
}
