import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import type {NextConfig} from 'next/dist/types.js'

export function withAlinea(config: NextConfig): NextConfig {
  let nextVersion = 15
  try {
    // Ducktape this together so we can get the package.json contents regardless
    // of .cjs, .mjs, compiled .ts or Node version
    const require = createRequire(resolve('./index.js'))
    const pkgLocation = require.resolve('next/package.json')
    const pkg = JSON.parse(readFileSync(pkgLocation, 'utf-8'))
    nextVersion = Number(pkg.version.split('.')[0])
  } catch {
    console.warn('Alinea could not determine Next.js version, assuming 15+')
  }
  if (nextVersion < 15)
    return {
      ...config,
      experimental: {
        ...config.experimental,
        serverComponentsExternalPackages: [
          ...(config.experimental?.serverComponentsExternalPackages ?? []),
          '@alinea/generated'
        ]
      }
    }
  return {
    ...config,
    serverExternalPackages: [
      ...(config.serverExternalPackages ?? []),
      '@alinea/generated'
    ]
  }
}
