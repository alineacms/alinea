import type {NextConfig} from 'next/dist/types.js'
import {existsSync, realpathSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path'

/** Next resolves include globs relative to the application, not its distDir. */
export function databaseTracing(
  config: NextConfig,
  projectDir: string,
  routes: ReadonlyArray<string> = ['/*']
): NextConfig['outputFileTracingIncludes'] {
  projectDir = realpathSync(projectDir)
  const require = createRequire(resolve(projectDir, 'package.json'))
  let packageDir: string | undefined
  try {
    packageDir = dirname(require.resolve('@alinea/generated/package.json'))
  } catch {
    // Generated packages from an earlier build may not export package.json.
    for (const base of require.resolve.paths('@alinea/generated') ?? []) {
      const candidate = join(base, '@alinea/generated')
      if (existsSync(join(candidate, 'package.json'))) {
        packageDir = candidate
        break
      }
    }
  }
  if (!packageDir || routes.length === 0)
    return config.outputFileTracingIncludes
  packageDir = realpathSync(packageDir)
  if (config.outputFileTracingRoot) {
    const within = relative(
      realpathSync(resolve(projectDir, config.outputFileTracingRoot)),
      packageDir
    )
    if (within === '..' || within.startsWith(`..${sep}`) || isAbsolute(within))
      throw new Error(
        'The generated Alinea database is outside outputFileTracingRoot; include its package in the tracing root'
      )
  }
  const artifacts = ['database.js', 'release.sqlite'].map(file =>
    relative(projectDir, join(packageDir!, file))
      .split(sep)
      .join('/')
      .replace(/[?*[\]{}()!+@]/g, char => `[${char}]`)
  )
  const includes = {...config.outputFileTracingIncludes}
  for (const route of routes)
    includes[route] = [...new Set([...(includes[route] ?? []), ...artifacts])]
  return includes
}
