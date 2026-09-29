import {generatedDatabaseFile} from '#/database/Version.js'
import {createHash} from 'node:crypto'
import path from 'node:path'

export interface GeneratedPaths {
  /** The `@alinea/generated` package the alinea runtime imports from. */
  packageDir: string
  /** This project's compiled config and database, inside the package. */
  outDir: string
  databasePath: string
}

export interface GeneratedPathsOptions {
  /** Directory of the alinea package that serves the project. */
  alineaPackageDir: string
  rootDir: string
  configLocation: string
}

/**
 * The runtime imports `@alinea/generated` from the alinea package, so the
 * package sits next to it. Every project that shares that alinea install (a
 * hoisted monorepo) gets its own directory inside it, so concurrent dev
 * servers never share a config or database.
 */
export function generatedPaths({
  alineaPackageDir,
  rootDir,
  configLocation
}: GeneratedPathsOptions): GeneratedPaths {
  const nodeModules = alineaPackageDir.includes('node_modules')
    ? path.join(alineaPackageDir, '..')
    : path.join(alineaPackageDir, 'node_modules')
  const packageDir = path.join(nodeModules, '@alinea/generated')
  const outDir = path.join(packageDir, projectDirName(rootDir, configLocation))
  return {
    packageDir,
    outDir,
    databasePath: path.join(outDir, generatedDatabaseFile)
  }
}

export function projectDirName(rootDir: string, configLocation: string) {
  const root = path.resolve(rootDir)
  const identity = `${root}\0${path.resolve(configLocation)}`
  const hash = createHash('sha256').update(identity).digest('hex').slice(0, 10)
  const name = path
    .basename(root)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
  return `${name || 'project'}-${hash}`
}
