import type {NextConfig} from 'next/dist/types.js'
import {join} from '#/core/util/Paths.js'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname, relative, resolve} from 'node:path'

type RewritesResult = Awaited<ReturnType<NonNullable<NextConfig['rewrites']>>>

export function createCMS() {
  throw new Error(
    'Alinea was loaded in a CJS environment. Please ensure your project is marked as "type": "module" in package.json.'
  )
}

export function withAlinea(config: NextConfig = {}): NextConfig {
  const settings = resolveSettings(config)
  if (!settings) {
    console.warn(
      'Alinea dashboard settings were not provided; dashboard routing is disabled. Run Next.js through the Alinea CLI.'
    )
  }
  const adminPath = settings?.adminPath
  let nextVersion = 15
  // Ducktape this together so we can get the package.json contents regardless
  // of .cjs, .mjs, compiled .ts or Node version
  const require = createRequire(resolve('./index.js'))
  try {
    const pkgLocation = require.resolve('next/package.json')
    const pkg = JSON.parse(readFileSync(pkgLocation, 'utf-8'))
    nextVersion = Number(pkg.version.split('.')[0])
  } catch {
    console.warn('Alinea could not determine Next.js version, assuming 15+')
  }
  const rewrites = adminPath
    ? createRewrites(config, adminPath, settings.handlerUrl)
    : config.rewrites
  const images = adminPath ? createImages(config, adminPath) : config.images
  const env = settings
    ? {
        ...config.env,
        ALINEA_ADMIN_PATH: settings.adminPath,
        ALINEA_HANDLER_URL: settings.handlerUrl
      }
    : config.env
  if (nextVersion < 15)
    return {
      ...config,
      experimental: {
        ...config.experimental,
        serverComponentsExternalPackages: [
          ...(config.experimental?.serverComponentsExternalPackages ?? []),
          '@alinea/generated',
          '@alinea/sqlite-wasm'
        ]
      },
      rewrites,
      images,
      env
    }
  return {
    ...config,
    outputFileTracingIncludes: tracingIncludes(
      config.outputFileTracingIncludes,
      require
    ),
    serverExternalPackages: [
      ...(config.serverExternalPackages ?? []),
      '@alinea/generated',
      // Loads its native extension from the package directory.
      '@alinea/sqlite-wasm'
    ],
    rewrites,
    images,
    env
  }
}

/**
 * The native SQLite extension is loaded from a path that file tracing cannot
 * follow, so functions opening the generated database would miss it.
 */
function tracingIncludes(
  includes: Record<string, Array<string>> | undefined,
  require: NodeJS.Require
): Record<string, Array<string>> | undefined {
  try {
    const alinea = createRequire(require.resolve('alinea/package.json'))
    const sqlite = dirname(alinea.resolve('@alinea/sqlite-wasm/package.json'))
    const native = relative(process.cwd(), join(sqlite, 'dist/native'))
    const files = `${native.replaceAll('\\', '/')}/**`
    return {...includes, '/**': [...(includes?.['/**'] ?? []), files]}
  } catch {
    return includes
  }
}

function createImages(config: NextConfig, adminPath: string) {
  const filePattern = `${adminPath}/file/**`
  const localPatterns = config.images?.localPatterns
  // An omitted list allows every local image. Defining any pattern restricts
  // all others, so preserve the default with an explicit catch-all.
  if (!localPatterns)
    return {
      ...config.images,
      localPatterns: [{pathname: filePattern}, {pathname: '/**'}]
    }
  if (localPatterns.some(pattern => pattern.pathname === filePattern))
    return config.images
  return {
    ...config.images,
    localPatterns: [
      ...localPatterns,
      {
        pathname: filePattern
      }
    ]
  }
}

const emptyRewrites = {
  beforeFiles: [],
  afterFiles: [],
  fallback: []
}

function createRewrites(
  config: NextConfig,
  adminPath: string,
  handlerUrl: string
) {
  return async (): Promise<RewritesResult> => {
    const devServer = process.env.ALINEA_DEV_SERVER
    const nodeEnv = process.env.NODE_ENV
    const isDev = devServer && nodeEnv === 'development'
    const nextOrigin = process.env.__NEXT_PRIVATE_ORIGIN
    const nextHost = process.env.__NEXT_PRIVATE_HOST
    const origin = nextOrigin ?? (nextHost ? `http://${nextHost}` : null)
    const location = origin ? new URL(adminPath, origin).href : adminPath
    if (isDev && !process.env.__NEXT_PRIVATE_ALINEA_REPORTED) {
      process.env.__NEXT_PRIVATE_ALINEA_REPORTED = 'true'
      console.log(`${'- Alinea CMS'}:    ${location}\n`)
    }
    const existing = config.rewrites ? await config.rewrites() : []
    const rewrites = Array.isArray(existing)
      ? {...emptyRewrites, afterFiles: existing}
      : {...emptyRewrites, ...existing}
    if (isDev) {
      return {
        ...rewrites,
        beforeFiles: [
          ...rewrites.beforeFiles,
          {
            source: `${adminPath}/file/:file*`,
            destination: `${devServer}/api?file=:file*&delivery=proxy`
          },
          {
            source: `${adminPath}/:path*`,
            destination: `${devServer}${adminPath}/:path*`
          }
        ]
      }
    }
    return {
      ...rewrites,
      beforeFiles: [
        ...rewrites.beforeFiles,
        {
          source: `${adminPath}/file/:file*`,
          // Next's internal image optimizer does not follow redirects.
          destination: `${handlerUrl}?file=:file*&delivery=proxy`
        }
      ],
      afterFiles: [
        ...rewrites.afterFiles,
        {
          source: adminPath,
          destination: `${adminPath}.html`
        }
      ]
    }
  }
}

interface ResolvedSettings {
  adminPath: string
  handlerUrl: string
}

function resolveSettings(config: NextConfig): ResolvedSettings | undefined {
  const adminPath =
    config.env?.ALINEA_ADMIN_PATH ?? process.env.ALINEA_ADMIN_PATH
  if (!adminPath) return
  return {
    adminPath: normalizeBasePath(adminPath),
    handlerUrl:
      config.env?.ALINEA_HANDLER_URL ??
      process.env.ALINEA_HANDLER_URL ??
      '/api/cms'
  }
}

function normalizeBasePath(value: string): string {
  return join('/', value, '.')
}
