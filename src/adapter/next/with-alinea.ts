import type {NextConfig} from 'next/dist/types.js'
import {join} from '#/core/util/Paths.js'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'

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
          '@alinea/generated'
        ]
      },
      rewrites,
      images,
      env
    }
  return {
    ...config,
    serverExternalPackages: [
      ...(config.serverExternalPackages ?? []),
      '@alinea/generated'
    ],
    rewrites,
    images,
    env
  }
}

function createImages(config: NextConfig, adminPath: string) {
  // Next compares `search` literally, leave it out so the versioned file urls
  // (?v=<hash>) match whatever their query
  const filePattern = {pathname: `${adminPath}/file/**`}
  const localPatterns = config.images?.localPatterns
  // An omitted list allows every local image without a query. Defining any
  // pattern restricts all others, so keep that default explicitly.
  if (!localPatterns)
    return {
      ...config.images,
      localPatterns: [filePattern, {pathname: '**', search: ''}]
    }
  if (
    localPatterns.some(
      pattern =>
        pattern.pathname === filePattern.pathname &&
        pattern.search === undefined
    )
  )
    return config.images
  return {...config.images, localPatterns: [...localPatterns, filePattern]}
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
  const built = builtEnv(config)
  const adminPath =
    config.env?.ALINEA_ADMIN_PATH ??
    process.env.ALINEA_ADMIN_PATH ??
    built?.ALINEA_ADMIN_PATH
  if (!adminPath) return
  return {
    adminPath: normalizeBasePath(adminPath),
    handlerUrl:
      config.env?.ALINEA_HANDLER_URL ??
      process.env.ALINEA_HANDLER_URL ??
      built?.ALINEA_HANDLER_URL ??
      '/api/cms'
  }
}

// `next start` loads the config again, outside of the Alinea CLI. Use the
// settings the production build was made with, which Next keeps in its output.
function builtEnv(config: NextConfig): Record<string, string> | undefined {
  if (process.env.NODE_ENV !== 'production') return
  try {
    const file = resolve(
      config.distDir ?? '.next',
      'required-server-files.json'
    )
    const built = JSON.parse(readFileSync(file, 'utf-8'))
    return built?.config?.env
  } catch {
    return
  }
}

function normalizeBasePath(value: string): string {
  return join('/', value, '.')
}
