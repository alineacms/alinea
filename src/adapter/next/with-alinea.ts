import {NextConfig} from 'next/dist/types.js'
import pkg from 'next/package.json'

export function withAlinea(config: NextConfig): NextConfig {
  const majorVersion = Number(pkg.version.split('.')[0])
  if (majorVersion < 15)
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
    experimental: {
      ...config.experimental,
      turbo: {
        ...config.experimental?.turbo,
        resolveAlias: {
          ...config.experimental?.turbo?.resolveAlias,
          'next/dist/client/components/request-async-storage.external.js':
            'next/dist/server/app-render/work-unit-async-storage.external.js'
        }
      }
    },
    serverExternalPackages: [
      ...(config.serverExternalPackages ?? []),
      '@alinea/generated'
    ]
  }
}
