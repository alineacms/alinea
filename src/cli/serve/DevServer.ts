import path from 'node:path'
import {fetch, Headers, Request, type Response} from '@alinea/iso'
import {composeBackend} from '#/backend/api/CreateBackend.js'
import {createHandler} from '#/backend/Handler.js'
import {gitUser} from '#/backend/util/ExecGit.js'
import {CloudRemote} from '#/cloud/CloudRemote.js'
import type {CMS} from '#/core/CMS.js'
import {Config} from '#/core/Config.js'
import type {RemoteConnection, RequestContext} from '#/core/Connection.js'
import {developmentKeyHeader} from '#/core/Connection.js'
import {createId} from '#/core/Id.js'
import type {BuildOptions} from 'esbuild'
import {generate} from '../Generate.js'
import {dirname} from '../util/Dirname.js'
import {findConfigFile} from '../util/FindConfigFile.js'
import {reportError} from '../util/Report.js'
import {createLocalServer} from './CreateLocalServer.js'
import {GitHistory} from './GitHistory.js'
import {LiveReload} from './LiveReload.js'
import {LocalAuth} from './LocalAuth.js'
import {MemoryDrafts} from './MemoryDrafts.js'
import type {ServeContext} from './ServeContext.js'

const __dirname = dirname(import.meta.url)

interface LocalServer {
  close(): void
  handle(input: Request): Promise<Response>
}

export interface CreateDevServerOptions {
  cmd: 'dev' | 'build'
  base?: string
  staticDir?: string
  configFile?: string
  buildOptions?: BuildOptions
  alineaDev?: boolean
  production?: boolean
  apiKey?: string
  dashboardUrl: Promise<string>
  onAfterGenerate?: (message: string, config: Config) => void
}

export interface DevServer {
  close(): void
  handle(input: Request): Promise<Response>
}

export async function createDevServer(
  dir: string,
  options: CreateDevServerOptions
): Promise<DevServer> {
  const {
    cmd,
    base,
    configFile,
    staticDir = path.join(__dirname, '..', 'static'),
    alineaDev = false,
    production = false,
    dashboardUrl,
    onAfterGenerate
  } = options

  const rootDir = path.resolve(dir)
  const configLocation = configFile
    ? path.resolve(rootDir, configFile)
    : findConfigFile(rootDir)

  if (!configLocation) {
    throw new Error(`No Alinea config file found @ ${rootDir}`)
  }

  const context: ServeContext = {
    cmd,
    configLocation,
    rootDir,
    base,
    staticDir,
    alineaDev,
    buildOptions: options.buildOptions || {},
    production,
    liveReload: new LiveReload(),
    buildId: createId(),
    apiKey: options.apiKey ?? process.env.ALINEA_API_KEY ?? 'dev'
  }

  const drafts = new MemoryDrafts()
  const user = gitUser(rootDir)
  const generateFiles = generate({
    cmd,
    cwd: rootDir,
    configFile: path.relative(rootDir, configLocation),
    staticDir,
    dashboardUrl,
    watch: cmd === 'dev',
    onAfterGenerate
  })
  let currentCMS: CMS | undefined
  let currentServer: LocalServer | undefined
  let failed: unknown
  let resolveInitialServer!: (server: LocalServer) => void
  let rejectInitialServer!: (reason?: unknown) => void
  let initialServerResolved = false
  const initialServer = new Promise<LocalServer>((resolve, reject) => {
    resolveInitialServer = resolve
    rejectInitialServer = reject
  })

  function settleInitialServer(server: LocalServer) {
    if (initialServerResolved) return
    initialServerResolved = true
    resolveInitialServer(server)
  }

  function failInitialServer(error: unknown) {
    if (initialServerResolved) return
    initialServerResolved = true
    rejectInitialServer(error)
  }

  async function reloadServer() {
    try {
      for await (const {cms, db} of generateFiles) {
        if (currentCMS === cms) {
          context.liveReload.reload('refetch')
          continue
        }

        const history = new GitHistory(cms.config, rootDir)
        const handleApi = createHandler({
          cms,
          remote: backend,
          db,
          forwardMutations(request) {
            return forwardMutation(request, cms, context.apiKey)
          }
        })
        const nextServer = createLocalServer(
          context,
          cms,
          handleApi,
          await user
        )

        currentServer?.close()
        currentServer = nextServer
        currentCMS = cms
        settleInitialServer(nextServer)

        function backend(context: RequestContext): RemoteConnection {
          if (process.env.ALINEA_CLOUD_URL)
            return new CloudRemote(context, cms.config)
          const auth = new LocalAuth(context, user)
          return composeBackend(auth, db, drafts, history)
        }
      }

      failInitialServer(
        new Error('Alinea dev server stopped before the initial build finished')
      )
    } catch (error) {
      failed = error
      failInitialServer(error)
      if (error instanceof Error) reportError(error)
    }
  }

  void reloadServer()

  return {
    close() {
      currentServer?.close()
      void generateFiles.return(undefined)
    },
    async handle(request: Request) {
      if (failed) throw failed
      const server = currentServer ?? (await initialServer)
      return server.handle(request)
    }
  }
}

async function forwardMutation(
  request: Request,
  cms: CMS,
  apiKey: string
): Promise<Response | undefined> {
  const origin = forwardedRequestOrigin(request)
  if (!origin) return
  const source = new URL(request.url)
  const target = new URL(Config.handlerUrl(cms.config), origin)
  target.search = source.search
  const headers = new Headers(request.headers)
  for (const name of hopByHopHeaders) headers.delete(name)
  headers.set(developmentKeyHeader, apiKey)
  const init: RequestInit & {duplex: 'half'} = {
    method: request.method,
    headers,
    body: request.body,
    signal: request.signal,
    duplex: 'half'
  }
  return fetch(new Request(target, init))
}

const hopByHopHeaders = [
  'connection',
  'content-length',
  'expect',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]

function firstHeaderValue(value: string | null): string | undefined {
  return value?.split(',')[0]?.trim() || undefined
}

function forwardedRequestOrigin(request: Request): string | undefined {
  const host = firstHeaderValue(request.headers.get('x-forwarded-host'))
  if (!host) return
  const protocol =
    firstHeaderValue(request.headers.get('x-forwarded-proto')) ?? 'http'
  const normalizedProtocol = protocol.endsWith(':') ? protocol : `${protocol}:`
  return `${normalizedProtocol}//${host}`
}
