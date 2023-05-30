export interface GenerateContext {
  wasmCache: boolean
  rootDir: string
  configLocation: string
  configDir: string
  staticDir: string
  quiet: boolean
  outDir: string
  watch: boolean
  fix: boolean
}
