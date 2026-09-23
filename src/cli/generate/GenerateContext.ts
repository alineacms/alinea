export interface GenerateContext {
  cmd: 'dev' | 'build'
  wasmCache: boolean
  rootDir: string
  configLocation: string
  configDir: string
  staticDir: string
  quiet: boolean
  /** The shared `@alinea/generated` package. */
  packageDir: string
  /** This project's directory inside the generated package. */
  outDir: string
  fix: boolean
}
