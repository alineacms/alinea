import type {NextConfig} from 'next/dist/types.js'
import nextPkg from 'next/package.json' with {type: 'json'}

export function createCMS() {
  throw new Error(
    'Alinea was loaded in a CJS environment. Please ensure your project is marked as "type": "module" in package.json.'
  )
}

export function withAlinea(config: NextConfig): NextConfig {
  let nextVersion = 15
  try {
    nextVersion = Number(nextPkg.version.split('.')[0])
  } catch {
    console.warn('Alinea could not determine Next.js version, assuming 15+')
  }
  const imagesConfig = config.images ?? {}
  const remotePatterns = [
    ...(imagesConfig.remotePatterns ?? []),
    {
      protocol: 'https' as const,
      hostname: 'uploads.alinea.cloud'
    }
  ]
  const images = {
    ...imagesConfig,
    remotePatterns
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
      },
      images
    }
  return {
    ...config,
    serverExternalPackages: [
      ...(config.serverExternalPackages ?? []),
      '@alinea/generated',
      ...(process.env.NODE_ENV === 'development' ? ['alinea'] : [])
    ],
    images
  }
}
