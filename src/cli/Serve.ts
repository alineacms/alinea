import {JWTPreviews} from 'alinea/backend'
import {Handler} from 'alinea/backend/Handler'
import {HttpHandler} from 'alinea/backend/router/Router'
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
  const server = await startNodeServer(preferredPort)

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
  const dashboardName = production ? '(production) dashboard' : 'dashboard'
  const dashboardUrl = `http://localhost:${server.port}`
  console.log(`> Alinea ${dashboardName} available on ${dashboardUrl}`)

  const gen = generate({
    ...options,
    dashboardUrl,
    watch: true,
    onAfterGenerate: () => {
      options.onAfterGenerate?.({
        ALINEA_DEV_SERVER: dashboardUrl
      })
    }
  })[Symbol.asyncIterator]()
  let nextGen = gen.next()
  let cms: CMS | undefined
  let handle: HttpHandler | undefined

  while (true) {
    const current = await nextGen
    if (!current?.value) return
    const {cms: currentCMS, localData: fileData} = current.value
    if (currentCMS === cms) {
      context.liveReload.reload('refetch')
    } else {
      const backend = process.env.ALINEA_CLOUD_URL
        ? createCloudHandler(
            currentCMS,
            current.value.store,
            process.env.ALINEA_API_KEY
          )
        : new Handler({
            config: currentCMS,
            store: current.value.store,
            target: fileData,
            media: fileData,
            history: new GitHistory(currentCMS, rootDir),
            previews: new JWTPreviews('dev')
          })
      handle = createLocalServer(context, backend)
      cms = currentCMS
      context.liveReload.reload('refresh')
    }
    nextGen = gen.next()
    for await (const {request, respondWith} of server.serve(nextGen)) {
      handle!(request).then(respondWith)
    }
  }
}
