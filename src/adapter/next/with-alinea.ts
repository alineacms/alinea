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

export function withAlinea(config: NextConfig = {}): NextConfig {
  const settings = resolveGeneratedSettings()
  const adminPath = settings?.adminPath
  if (!adminPath) {
    console.warn(
      'Alinea dashboard environment is unavailable; dashboard routing is disabled. Run Next.js through the Alinea CLI.'
    )
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
  const redirects = adminPath
    ? createRedirects(config, adminPath)
    : config.redirects
  const rewrites = adminPath
    ? createRewrites(config, adminPath)
    : config.rewrites
  const env = settings
    ? {
        ...config.env,
        ALINEA_ADMIN_PATH: settings.adminPath,
        ALINEA_GENERATED_RELEASE: settings.releaseId,
        ALINEA_GENERATED_CONFIG: settings.configId,
        ALINEA_RELEASE_URL: `${settings.adminPath}/${settings.releaseId}/payload.bundle`,
        ALINEA_CONFIG_URL: `${settings.adminPath}/config/${settings.configId}/client-config.js`
      }
    : config.env
  return {
    ...config,
    images,
    env,
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

const emptyRewrites = {
  beforeFiles: [],
  afterFiles: [],
  fallback: []
}

function createRewrites(config: NextConfig, adminPath: string) {
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
            source: `${adminPath}/:path*`,
            destination: `${devServer}${adminPath}/:path*`
          }
        ]
      }
    }
    return {
      ...rewrites,
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

interface ResolvedGeneratedSettings {
  adminPath: string
  releaseId: string
  configId: string
}

function resolveGeneratedSettings(): ResolvedGeneratedSettings | undefined {
  const adminPath = process.env.ALINEA_ADMIN_PATH
  const releaseId = process.env.ALINEA_GENERATED_RELEASE
  const configId = process.env.ALINEA_GENERATED_CONFIG
  if (adminPath && releaseId && configId)
    return {
      adminPath: normalizeBasePath(adminPath),
      releaseId,
      configId
    }
}

function normalizeBasePath(value: string): string {
  return value.startsWith('/') ? value : `/${value}`
}
