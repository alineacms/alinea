import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import type {NextConfig} from 'next/dist/types.js'

type RedirectsResult = Awaited<ReturnType<NonNullable<NextConfig['redirects']>>>
type RewritesResult = Awaited<ReturnType<NonNullable<NextConfig['rewrites']>>>

export interface WithAlineaOptions {
  /**
   * Base path where the dashboard is mounted.
   *
   * @default '/admin'
   */
  adminPath?: string
}

export function createCMS() {
  throw new Error(
    'Alinea was loaded in a CJS environment. Please ensure your project is marked as "type": "module" in package.json.'
  )
}

export function withAlinea(
  config: NextConfig = {},
  options: WithAlineaOptions = {}
): NextConfig {
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
  const adminPath = normalizeBasePath(options.adminPath ?? '/admin')
  const redirects = createRedirects(config, adminPath)
  const rewrites = createRewrites(config, adminPath)
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
      images,
      redirects,
      rewrites
    }
  return {
    ...config,
    serverExternalPackages: [
      ...(config.serverExternalPackages ?? []),
      '@alinea/generated'
    ],
    images,
    redirects,
    rewrites
  }
}

function createRedirects(config: NextConfig, adminPath: string) {
  const dev = process.env.ALINEA_DEV_SERVER
  if (!dev) return config.redirects
  return async (): Promise<RedirectsResult> => {
    const existing = config.redirects ? await config.redirects() : []
    return [
      ...existing,
      {
        permanent: true,
        source: `${adminPath}/~dev`,
        destination: `${dev}/~dev`
      }
    ]
  }
}

function createRewrites(config: NextConfig, adminPath: string) {
  return async (): Promise<RewritesResult> => {
    const existing = config.rewrites ? await config.rewrites() : []
    const dev = process.env.ALINEA_DEV_SERVER
    const alineaRewrites = [
      {
        source: `${adminPath}/:path*`,
        // TODO: admin.html can be configured, but we'll not have access
        // to config here. In next breaking changes we can remove it
        // as an option and use a unique name because it will be exposed
        // as adminPath anyway.
        destination: dev ? `${dev}${adminPath}/:path*` : '/admin.html'
      }
    ]
    return appendRewrites(existing, alineaRewrites)
  }
}

function appendRewrites(
  rewrites: RewritesResult,
  extra: Array<{source: string; destination: string}>
): RewritesResult {
  if (Array.isArray(rewrites)) return [...rewrites, ...extra]
  return {
    beforeFiles: rewrites.beforeFiles ?? [],
    afterFiles: [...(rewrites.afterFiles ?? []), ...extra],
    fallback: rewrites.fallback ?? []
  }
}

function normalizeBasePath(value: string): string {
  return value.startsWith('/') ? value : `/${value}`
}
