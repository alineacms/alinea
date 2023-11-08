import {JWTPreviews} from 'alinea/backend'
import {Handler} from 'alinea/backend/Handler'
import {HttpRouter} from 'alinea/backend/router/Router'
import {createCloudDebugHandler} from 'alinea/cloud/server/CloudDebugHandler'
import {createCloudHandler} from 'alinea/cloud/server/CloudHandler'
import {CMS} from 'alinea/core/CMS'
import {BuildOptions} from 'esbuild'
import path from 'node:path'
import {generate} from './Generate.js'
import {buildOptions} from './build/BuildOptions.js'
import {createLocalServer} from './serve/CreateLocalServer.js'
import {GitHistory} from './serve/GitHistory.js'
import {LiveReload} from './serve/LiveReload.js'
import {ServeContext} from './serve/ServeContext.js'
import {startNodeServer} from './serve/StartNodeServer.js'
import {dirname} from './util/Dirname.js'
import {findConfigFile} from './util/FindConfigFile.js'

const __dirname = dirname(import.meta.url)

export type ServeOptions = {
  cwd?: string
  staticDir?: string
  configFile?: string
  port?: number
  buildOptions?: BuildOptions
  alineaDev?: boolean
  production?: boolean
  onAfterGenerate?: (env?: Record<string, string>) => void
}

export async function serve(options: ServeOptions): Promise<void> {
  const {
    cwd = process.cwd(),
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
    const dashboardName = production ? '(production) dashboard' : 'dashboard'
    console.log(`> Alinea ${dashboardName} available on ${await dashboardUrl}`)
  })

  const gen = generate({
    ...options,
    dashboardUrl,
    watch: true,
    async onAfterGenerate() {
      options.onAfterGenerate?.({
        ALINEA_DEV_SERVER: await dashboardUrl
      })
    }
  })[Symbol.asyncIterator]()
  let nextGen = gen.next()
  let cms: CMS | undefined
  let handle: HttpRouter | undefined

  while (true) {
    const current = await nextGen
    if (!current?.value) return
    const {cms: currentCMS, localData: fileData, db} = current.value
    if (currentCMS === cms) {
      context.liveReload.reload('refetch')
    } else {
      const backend = createBackend()
      handle = createLocalServer(context, backend)
      cms = currentCMS
      context.liveReload.reload('refresh')

      function createBackend(): Handler {
        if (process.env.ALINEA_CLOUD_DEBUG)
          return createCloudDebugHandler(currentCMS, db)
        if (process.env.ALINEA_CLOUD_URL)
          return createCloudHandler(currentCMS, db, process.env.ALINEA_API_KEY)
        return new Handler({
          config: currentCMS,
          db,
          target: fileData,
          media: fileData,
          history: new GitHistory(currentCMS, rootDir),
          previews: new JWTPreviews('dev')
        })
      }
    }
    nextGen = gen.next()
    const {serve} = await server
    for await (const {request, respondWith} of serve(nextGen)) {
      handle!(request).then(respondWith)
    }
  }
}
