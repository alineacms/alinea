import {Backend} from 'alinea/backend/Backend'
import {createHandle} from 'alinea/backend/Handle'
import {HttpRouter} from 'alinea/backend/router/Router'
import {cloudBackend} from 'alinea/cloud/CloudBackend'
import {cloudDebug} from 'alinea/cloud/CloudDebug'
import {CMS} from 'alinea/core/CMS'
import {localUser} from 'alinea/core/User'
import {BuildOptions} from 'esbuild'
import path from 'node:path'
import simpleGit from 'simple-git'
import pkg from '../../package.json'
import {generate} from './Generate.js'
import {buildOptions} from './build/BuildOptions.js'
import {createLocalServer} from './serve/CreateLocalServer.js'
import {GitHistory} from './serve/GitHistory.js'
import {LiveReload} from './serve/LiveReload.js'
import {localAuth} from './serve/LocalAuth.js'
import {MemoryDrafts} from './serve/MemoryDrafts.js'
import {ServeContext} from './serve/ServeContext.js'
import {startNodeServer} from './serve/StartNodeServer.js'
import {dirname} from './util/Dirname.js'
import {findConfigFile} from './util/FindConfigFile.js'

const __dirname = dirname(import.meta.url)

export type ServeOptions = {
  cwd?: string
  base?: string
  staticDir?: string
  configFile?: string
  port?: number
  buildOptions?: BuildOptions
  alineaDev?: boolean
  production?: boolean
  watch?: boolean
  onAfterGenerate?: (env?: Record<string, string>) => void
}

export async function serve(options: ServeOptions): Promise<void> {
  const {
    cwd = process.cwd(),
    base,
    configFile,
    staticDir = path.join(__dirname, 'static'),
    alineaDev = false,
    production = false
  } = options

  const configLocation = configFile
    ? path.join(path.resolve(cwd), configFile)
    : findConfigFile(cwd)
  if (!configLocation) throw new Error(`No config file specified`)

  const preferredPort = options.port ? Number(options.port) : 4500
  const server = startNodeServer(preferredPort)
  const dashboardUrl = server.then(server => `http://localhost:${server.port}`)

  const rootDir = path.resolve(cwd)
  const context: ServeContext = {
    rootDir,
    base,
    staticDir,
    alineaDev,
    buildOptions: {
      ...buildOptions,
      ...options.buildOptions,
      plugins: (buildOptions.plugins || []).concat(
        options.buildOptions?.plugins || []
      )
    },
    production,
    liveReload: new LiveReload()
  }

  server.then(async () => {
    console.log(`  \x1b[36mα Alinea ${pkg.version}\x1b[39m`)
    console.log(`  - Local CMS:    ${await dashboardUrl}\n`)
  })

  const gen = generate({
    ...options,
    dashboardUrl,
    watch: options.watch,
    async onAfterGenerate() {
      options.onAfterGenerate?.({
        ALINEA_BASE_URL: base ?? '',
        ALINEA_DEV_SERVER: (await dashboardUrl) + '/api'
      })
    }
  })[Symbol.asyncIterator]()
  const drafts = new MemoryDrafts()
  let nextGen = gen.next()
  let cms: CMS | undefined
  let handleRequest: HttpRouter | undefined

  const git = simpleGit(rootDir)
  const [name = localUser.name, email] = (
    await Promise.all([git.getConfig('user.name'), git.getConfig('user.email')])
  ).map(res => res.value ?? undefined)
  const user = {...localUser, name, email}

  while (true) {
    const current = await nextGen
    if (!current?.value) return
    const {cms: currentCMS, localData: fileData, db} = current.value
    if (currentCMS === cms) {
      context.liveReload.reload('refetch')
    } else {
      const history = new GitHistory(git, currentCMS.config, rootDir)
      const backend = createBackend()
      const handleApi = createHandle(currentCMS, backend, Promise.resolve(db))
      handleRequest = createLocalServer(context, handleApi, user)
      cms = currentCMS
      context.liveReload.reload('refresh')

      function createBackend(): Backend {
        if (process.env.ALINEA_CLOUD_DEBUG)
          return cloudDebug(currentCMS.config, rootDir)
        if (process.env.ALINEA_CLOUD_URL) return cloudBackend(currentCMS.config)
        return {
          auth: localAuth(git),
          target: fileData,
          media: fileData,
          drafts,
          history
        }
      }
    }
    nextGen = gen.next()
    const {serve} = await server
    for await (const {request, respondWith} of serve(nextGen)) {
      handleRequest!(request).then(respondWith)
    }
  }
}
