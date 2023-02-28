export interface GenerateContext {
  wasmCache: boolean
  cwd: string
  configLocation: string
  staticDir: string
  quiet: boolean
  outDir: string
  watch: boolean
  fix: boolean
}
