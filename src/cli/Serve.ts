import {Backend} from 'alinea/backend/Backend'
import {createHandler} from 'alinea/backend/Handler'
import {gitUser} from 'alinea/backend/util/ExecGit'
import {cloudBackend} from 'alinea/cloud/CloudBackend'
import {cloudDebug} from 'alinea/cloud/CloudDebug'
import {CMS} from 'alinea/core/CMS'
import {genEffect} from 'alinea/core/util/Async'
import {BuildOptions} from 'esbuild'
import path from 'node:path'
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
import {bold, cyan, gray, reportHalt} from './util/Report.js'

const __dirname = dirname(import.meta.url)

export type ServeOptions = {
  cmd: 'dev' | 'build'
  cwd?: string
  base?: string
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
    base,
    configFile,
    staticDir = path.join(__dirname, 'static'),
    alineaDev = false,
    production = false,
    cmd
  } = options

  const configLocation = configFile
    ? path.join(path.resolve(cwd), configFile)
    : findConfigFile(cwd)

  if (!configLocation) {
    reportHalt(`No Alinea config file found @ ${cwd}`)
    process.exit(1)
  }

  const preferredPort = options.port ? Number(options.port) : 4500
  const server = startNodeServer(preferredPort, 0, cmd === 'build')
  const dashboardUrl = server.then(server => `http://localhost:${server.port}`)

  const rootDir = path.resolve(cwd)
  const context: ServeContext = {
    cmd,
    configLocation,
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

  const drafts = new MemoryDrafts()
  let currentCMS: CMS | undefined
  let serveController = new AbortController()
  let localServer:
    | {
        close(): void
        handle(input: Request): Promise<Response>
      }
    | undefined

  const fileEmitter = generate({
    ...options,
    dashboardUrl,
    watch: cmd === 'dev',
    onAfterGenerate(msg) {
      dashboardUrl.then(url => {
        const version = gray(pkg.version)
        const header = `  ${cyan(bold('ɑ'))} Alinea ${version}\n`
        const connector = gray(cmd === 'dev' ? '├' : '╰')
        const details = `  ${connector} ${gray(msg)}\n`
        const footer =
          cmd === 'dev' ? `  ${gray('╰')} Local CMS:    ${url}\n\n` : '\n'
        process.stdout.write(header + details + footer)
        options.onAfterGenerate?.({
          ALINEA_DEV_SERVER: url
        })
      })
    }
  })

  const generateFiles = genEffect(fileEmitter, () => {
    serveController.abort()
    serveController = new AbortController()
  })

  const user = await gitUser(rootDir)

  for await (const {cms, localData: fileData, db} of generateFiles) {
    if (currentCMS === cms) {
      context.liveReload.reload('refetch')
    } else {
      const history = new GitHistory(cms.config, rootDir)
      const backend = createBackend()
      const handleApi = createHandler({
        cms,
        backend,
        database: Promise.resolve(db)
      })
      if (localServer) localServer.close()
      localServer = createLocalServer(context, cms, handleApi, user)
      currentCMS = cms

      function createBackend(): Backend {
        if (process.env.ALINEA_CLOUD_DEBUG)
          return cloudDebug(cms.config, rootDir)
        if (process.env.ALINEA_CLOUD_URL) return cloudBackend(cms.config)
        return {
          auth: localAuth(rootDir),
          target: fileData,
          media: fileData,
          drafts,
          history
        }
      }
    }

    const {serve} = await server
    for await (const {request, respondWith} of serve(serveController)) {
      localServer!.handle(request).then(respondWith)
    }
  }

  const {close} = await server
  close()
}
