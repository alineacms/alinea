import {JWTPreviews} from 'alinea/backend'
import {Handler} from 'alinea/backend/Handler'
import {FileData} from 'alinea/backend/data/FileData'
import {nodeHandler} from 'alinea/backend/router/NodeHandler'
import {createCloudHandler} from 'alinea/cloud/server/CloudHandler'
import {CMS} from 'alinea/core/CMS'
import {BuildOptions} from 'esbuild'
import fs from 'node:fs'
import {RequestListener} from 'node:http'
import path from 'node:path'
import {generate} from './Generate.js'
import {buildOptions} from './build/BuildOptions.js'
import {createHandler} from './serve/CreateHandler.js'
import {LiveReload} from './serve/LiveReload.js'
import {ServeContext} from './serve/ServeContext.js'
import {startServer} from './serve/StartServer.js'
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

  const preferredPort = options.port ? Number(options.port) : 4500
  const server = await startServer(preferredPort)
  const dashboardName = production ? '(production) dashboard' : 'dashboard'
  const dashboardUrl = `http://localhost:${server.port}`
  console.log(`> Alinea ${dashboardName} available on ${dashboardUrl}`)

  const gen = generate({
    ...options,
    watch: true,
    onAfterGenerate: () => {
      options.onAfterGenerate?.({
        ALINEA_DEV_SERVER: dashboardUrl
      })
    }
  })[Symbol.asyncIterator]()
  let nextGen = gen.next()
  let cms: CMS | undefined
  let handler: RequestListener | undefined

  while (true) {
    const current = await nextGen
    if (!current?.value) return
    const currentCMS = current.value.cms
    if (currentCMS === cms) {
      context.liveReload.reload('refetch')
    } else {
      const fileData = new FileData({
        config: currentCMS,
        fs: fs.promises,
        rootDir: rootDir
      })
      const backend = process.env.ALINEA_CLOUD_URL
        ? createCloudHandler(
            currentCMS,
            current.value.store,
            process.env.ALINEA_API_KEY
          )
        : new Handler({
            // dashboardUrl,
            config: currentCMS,
            store: current.value.store,
            target: fileData,
            media: fileData,
            previews: new JWTPreviews('dev')
          })
      handler = nodeHandler(createHandler(context, backend).handle)
      cms = currentCMS
      context.liveReload.reload('refresh')
    }
    nextGen = gen.next()
    for await (const [request, response] of server.serve(nextGen)) {
      handler!(request, response)
    }
  }
}
