import {Database} from 'alinea/backend/Database'
import {Store} from 'alinea/backend/Store'
import {exportStore} from 'alinea/cli/util/ExportStore.server'
import {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {genEffect} from 'alinea/core/util/Async'
import {basename, join} from 'alinea/core/util/Paths'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import prettyBytes from 'pretty-bytes'
import {compileConfig} from './generate/CompileConfig.js'
import {copyStaticFiles} from './generate/CopyStaticFiles.js'
import {fillCache} from './generate/FillCache.js'
import {GenerateContext} from './generate/GenerateContext.js'
import {generateDashboard} from './generate/GenerateDashboard.js'
import {LocalData} from './generate/LocalData.js'
import {dirname} from './util/Dirname.js'
import {Emitter} from './util/Emitter.js'
import {findConfigFile} from './util/FindConfigFile.js'
import {reportHalt} from './util/Report.js'

const __dirname = dirname(import.meta.url)
const require = createRequire(import.meta.url)
const alineaPackageDir = path.dirname(require.resolve('alinea/package.json'))

export interface GenerateOptions {
  cmd: 'dev' | 'build'
  cwd?: string
  staticDir?: string
  configFile?: string
  watch?: boolean
  fix?: boolean
  wasmCache?: boolean
  quiet?: boolean
  onAfterGenerate?: (buildMessage: string) => void
  dashboardUrl?: Promise<string>
}

async function generatePackage(context: GenerateContext, config: Config) {
  if (!config.dashboardFile) return
  const staticFile = config.dashboardFile
    ? join(config.publicDir, config.dashboardFile)
    : undefined
  if (!staticFile) return
  await generateDashboard(context, config.handlerUrl ?? '/api/cms', staticFile)
  return basename(staticFile)
}

async function createDb(): Promise<[Store, () => Uint8Array]> {
  const {default: sqlite} = await import('@alinea/sqlite-wasm')
  const {Database} = await sqlite()
  const {connect} = await import('rado/driver/sql.js')
  const db = new Database()
  const store = connect(db)
  return [store, () => db.export()]
}

export async function* generate(options: GenerateOptions): AsyncGenerator<
  {
    cms: CMS
    db: Database
    localData: LocalData
  },
  void
> {
  const {
    cmd,
    wasmCache = false,
    cwd = process.cwd(),
    configFile,
    staticDir = path.join(__dirname, 'static'),
    quiet = false,
    onAfterGenerate
  } = options

  const now = performance.now()

  const configLocation = configFile
    ? path.join(path.resolve(cwd), configFile)
    : findConfigFile(cwd)
  if (!configLocation) throw new Error(`No config file specified`)
  const location = path
    .relative(process.cwd(), configLocation)
    .replace(/\\/g, '/')
  const rootDir = path.resolve(cwd)
  const configDir = path.dirname(configLocation)

  const nodeModules = alineaPackageDir.includes('node_modules')
    ? path.join(alineaPackageDir, '..')
    : path.join(alineaPackageDir, 'node_modules')

  const context: GenerateContext = {
    cmd,
    wasmCache,
    rootDir: rootDir,
    staticDir,
    quiet,
    configDir,
    configLocation,
    fix: options.fix || false,
    outDir: path.join(nodeModules, '@alinea/generated')
  }
  await copyStaticFiles(context)
  let indexing: Emitter<Database>
  const builder = compileConfig(context)
  const builds = genEffect(builder, () => indexing?.return())
  let afterGenerateCalled = false

  function writeStore(data: Uint8Array) {
    return exportStore(data, join(context.outDir, 'store.js'))
  }
  const [store, storeData] = await createDb()
  for await (const cms of builds) {
    const write = async () => {
      let dbSize = 0
      if (cmd === 'build') {
        ;[, dbSize] = await Promise.all([
          generatePackage(context, cms.config),
          writeStore(storeData())
        ])
      } else {
        await writeStore(new Uint8Array())
      }
      let message = `${cmd} ${location} in `
      const duration = performance.now() - now
      if (duration > 1000) message += `${(duration / 1000).toFixed(2)}s`
      else message += `${duration.toFixed(0)}ms`
      if (dbSize > 0) message += ` (db ${prettyBytes(dbSize)})`
      return message
    }
    const fileData = new LocalData({
      config: cms.config,
      fs: fs.promises,
      rootDir,
      dashboardUrl: await options.dashboardUrl
    })
    indexing = fillCache(context, fileData, store, cms.config)
    for await (const db of indexing) {
      yield {cms, db, localData: fileData}
      if (onAfterGenerate && !afterGenerateCalled)
        await write().then(
          message => {
            afterGenerateCalled = true
            onAfterGenerate(message)
          },
          () => {
            reportHalt('Alinea failed to write dashboard files')
            if (cmd === 'build') process.exit(1)
          }
        )
    }
  }
}
