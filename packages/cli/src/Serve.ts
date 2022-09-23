import {nodeHandler} from '@alinea/backend/router/NodeHandler'
import {BuildOptions} from 'esbuild'
import fs from 'fs-extra'
import {RequestListener} from 'node:http'
import path from 'node:path'
import {buildOptions} from './build/BuildOptions'
import {generate} from './Generate'
import {ServeBackend} from './serve/backend/ServeBackend'
import {createHandler} from './serve/CreateHandler'
import {LiveReload} from './serve/LiveReload'
import {ServeContext} from './serve/ServeContext'
import {startServer} from './serve/StartServer'
import {dirname} from './util/Dirname'

const __dirname = dirname(import.meta.url)

export type ServeOptions = {
  cwd?: string
  staticDir?: string
  configFile?: string
  port?: number
  buildOptions?: BuildOptions
  alineaDev?: boolean
  production?: boolean
  onAfterGenerate?: () => void
}

export async function serve(options: ServeOptions): Promise<void> {
  const {
    cwd = process.cwd(),
    staticDir = path.join(__dirname, 'static'),
    alineaDev = false,
    production = false
  } = options

  const absoluteWorkingDir = path.resolve(cwd)

  const context: ServeContext = {
    cwd: absoluteWorkingDir,
    staticDir,
    alineaDev,
    buildOptions: {
      ...buildOptions,
      ...options.buildOptions,
      plugins: buildOptions.plugins!.concat(options.buildOptions?.plugins || [])
    },
    production,
    liveReload: new LiveReload()
  }

  const preferredPort = options.port ? Number(options.port) : 4500
  const server = await startServer(preferredPort)
  const dashboardName = production ? '(production) dashboard' : 'dashboard'
  console.log(
    `> Alinea ${dashboardName} available on http://localhost:${server.port}`
  )

  await fs.writeFile(
    path.join(cwd, '.alinea/drafts.js'),
    `export const serverLocation = 'http://localhost:${server.port}'`
  )

  const gen = generate({...options, watch: true})[Symbol.asyncIterator]()
  let nextGen = gen.next()
  let backend: ServeBackend | undefined
  let handler: RequestListener
  while (true) {
    const {value} = await nextGen
    const {config, store} = value!
    if (backend && backend.config === config) {
      backend.replaceStore(store)
      context.liveReload.reload('refetch')
    } else {
      backend = new ServeBackend({cwd, port: server.port, config, store})
      handler = nodeHandler(createHandler(context, backend).handle)
      context.liveReload.reload('refresh')
    }
    nextGen = gen.next()
    for await (const [request, response] of server.serve(nextGen)) {
      handler!(request, response)
    }
  }
}
