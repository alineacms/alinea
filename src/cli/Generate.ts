import {Store} from 'alinea/backend/Store'
import {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {BuildResult} from 'esbuild'
import path from 'node:path'
import {connect} from 'rado/driver/sql.js'
import {compileConfig} from './generate/CompileConfig.js'
import {copyStaticFiles} from './generate/CopyStaticFiles.js'
import {fillCache} from './generate/FillCache.js'
import {GenerateContext} from './generate/GenerateContext.js'
import {generateDashboard} from './generate/GenerateDashboard.js'
import {loadCMS} from './generate/LoadConfig.js'
import {dirname} from './util/Dirname.js'

const __dirname = dirname(import.meta.url)

export type GenerateOptions = {
  cwd?: string
  staticDir?: string
  configFile?: string
  watch?: boolean
  fix?: boolean
  wasmCache?: boolean
  quiet?: boolean
  onAfterGenerate?: (env?: Record<string, string>) => void
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
  const {default: sqlite} = await import('@alinea/sqlite-wasm')
  const {Database} = await sqlite()
  const db = new Database()
  const store = connect(db).toAsync()
  return [store, () => db.export()]
}

export async function* generate(options: GenerateOptions): AsyncGenerator<
  {
    cms: CMS
    store: Store
  },
  void
> {
  const {
    wasmCache = false,
    cwd = process.cwd(),
    configFile = 'alinea.config',
    staticDir = path.join(__dirname, 'static'),
    quiet = false,
    onAfterGenerate
  } = options

  const rootDir = path.resolve(cwd)
  const configLocation = path.join(path.resolve(cwd), configFile)
  const configDir = path.dirname(configLocation)

  const context: GenerateContext = {
    wasmCache,
    rootDir: rootDir,
    configDir,
    staticDir,
    quiet,
    configLocation,
    fix: options.fix || false,
    outDir: path.join(rootDir, '.alinea'),
    watch: options.watch || false
  }

  const builds = compileConfig(context)[Symbol.asyncIterator]()
  let nextBuild: Promise<{value: BuildResult; done?: boolean}> = builds.next()
  let afterGenerateCalled = false

  const [store, exportStore] = await createDb()
  await copyStaticFiles(context)
  while (true) {
    const {done} = await nextBuild
    nextBuild = builds.next()
    try {
      const cms = await loadCMS(context.outDir)
      for await (const _ of fillCache(context, store, cms, nextBuild)) {
        yield {cms, store}
        // For debug reasons write out db
        // fs.writeFile(path.join(context.outDir, 'content.sqlite'), exportStore())
        if (onAfterGenerate && !afterGenerateCalled) {
          afterGenerateCalled = true
          onAfterGenerate()
        }
      }
      if (done) {
        await Promise.all([
          generatePackage(context, cms),
          cms.exportStore(context.outDir, exportStore())
        ])
        break
      }
    } catch (e: any) {
      console.log(e.message)
    }
  }
}
