import {Database} from 'alinea/backend'
import {Store} from 'alinea/backend/Store'
import {exportStore} from 'alinea/cli/util/ExportStore.server'
import {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {join} from 'alinea/core/util/Paths'
import {BuildResult} from 'esbuild'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {compileConfig} from './generate/CompileConfig.js'
import {copyStaticFiles} from './generate/CopyStaticFiles.js'
import {fillCache} from './generate/FillCache.js'
import {GenerateContext} from './generate/GenerateContext.js'
import {generateDashboard} from './generate/GenerateDashboard.js'
import {loadCMS} from './generate/LoadConfig.js'
import {LocalData} from './generate/LocalData.js'
import {dirname} from './util/Dirname.js'
import {findConfigFile} from './util/FindConfigFile.js'

const __dirname = dirname(import.meta.url)
const require = createRequire(import.meta.url)
const alineaPackageDir = path.dirname(require.resolve('alinea/package.json'))

export interface GenerateOptions {
  cwd?: string
  staticDir?: string
  configFile?: string
  watch?: boolean
  fix?: boolean
  wasmCache?: boolean
  quiet?: boolean
  onAfterGenerate?: (env?: Record<string, string>) => void
  dashboardUrl?: Promise<string>
}

function generatePackage(context: GenerateContext, config: Config) {
  const dashboard = config.dashboard
  if (dashboard?.staticFile)
    return generateDashboard(
      context,
      dashboard.handlerUrl,
      dashboard.staticFile!
    )
}

async function createDb(): Promise<[Store, () => Uint8Array]> {
  /*try {
    const {default: betterSqlite3} = await import('better-sqlite3')
    const {connect} = await import('rado/driver/better-sqlite3')
    const db = betterSqlite3(':memory:')
    const store = connect(db).toAsync()
    return [store, () => db.serialize()]
  } catch {*/
  const {default: sqlite} = await import('@alinea/sqlite-wasm')
  const {Database} = await sqlite()
  const {connect} = await import('rado/driver/sql.js')
  const db = new Database()
  const store = connect(db).toAsync()
  return [store, () => db.export()]
  //}
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
    wasmCache = false,
    cwd = process.cwd(),
    configFile,
    staticDir = path.join(__dirname, 'static'),
    quiet = false,
    onAfterGenerate
  } = options

  const configLocation = configFile
    ? path.join(path.resolve(cwd), configFile)
    : findConfigFile(cwd)
  if (!configLocation) throw new Error(`No config file specified`)
  const rootDir = path.resolve(cwd)
  const configDir = path.dirname(configLocation)

  const nodeModules = alineaPackageDir.includes('node_modules')
    ? path.join(alineaPackageDir, '..')
    : path.join(alineaPackageDir, 'node_modules')

  const context: GenerateContext = {
    wasmCache,
    rootDir: rootDir,
    staticDir,
    quiet,
    configDir,
    configLocation,
    fix: options.fix || false,
    outDir: path.join(nodeModules, '@alinea/generated'), // path.join(rootDir, '.alinea'),
    watch: options.watch || false
  }

  const builds = compileConfig(context)[Symbol.asyncIterator]()
  let nextBuild: Promise<{value: BuildResult; done?: boolean}> = builds.next()
  let afterGenerateCalled = false

  function writeStore(data: Uint8Array) {
    return exportStore(data, join(context.outDir, 'store.js'))
  }
  const [store, storeData] = await createDb()
  await copyStaticFiles(context)
  while (true) {
    const {done} = await nextBuild
    nextBuild = builds.next()
    try {
      const cms = await loadCMS(context.outDir)
      await writeStore(new Uint8Array())
      const fileData = new LocalData({
        config: cms.config,
        fs: fs.promises,
        rootDir,
        dashboardUrl: await options.dashboardUrl
      })
      for await (const db of fillCache(
        context,
        fileData,
        store,
        cms.config,
        nextBuild
      )) {
        yield {cms, db, localData: fileData}
        if (onAfterGenerate && !afterGenerateCalled) {
          afterGenerateCalled = true
          onAfterGenerate()
        }
      }
      if (done) {
        await Promise.all([
          generatePackage(context, cms.config),
          writeStore(storeData())
        ])
        break
      }
    } catch (e: any) {
      console.error(e)
    }
  }
}
