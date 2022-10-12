import {Config} from '@alinea/core/Config'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import {BuildResult} from 'esbuild'
import path from 'node:path'
import {compileConfig} from './generate/CompileConfig'
import {copyBoilerplate} from './generate/CopyBoilerplate'
import {copyStaticFiles} from './generate/CopyStaticFiles'
import {fillCache} from './generate/FillCache'
import {GenerateContext} from './generate/GenerateContext'
import {generateDashboard} from './generate/GenerateDashboard'
import {generateSchema} from './generate/GenerateSchema'
import {loadConfig} from './generate/LoadConfig'
import {dirname} from './util/Dirname'

const __dirname = dirname(import.meta.url)

export type GenerateOptions = {
  cwd?: string
  staticDir?: string
  configFile?: string
  watch?: boolean
  fix?: boolean
  wasmCache?: boolean
  quiet?: boolean
  store?: SqliteStore
  onAfterGenerate?: () => void
}

function generatePackage(context: GenerateContext, config: Config) {
  const tasks = [generateSchema(context, config)]
  const dashboard = config.dashboard
  if (dashboard?.staticFile)
    tasks.push(
      generateDashboard(context, dashboard.handlerUrl, dashboard.staticFile!)
    )
  return Promise.all(tasks)
}

export async function* generate(options: GenerateOptions) {
  const {
    wasmCache = false,
    cwd = process.cwd(),
    configFile = 'alinea.config',
    staticDir = path.join(__dirname, 'static'),
    quiet = false,
    onAfterGenerate
  } = options

  const absoluteWorkingDir = path.resolve(cwd)

  const context: GenerateContext = {
    wasmCache,
    cwd: absoluteWorkingDir,
    staticDir,
    quiet,
    configLocation: path.join(absoluteWorkingDir, configFile),
    fix: options.fix || false,
    outDir: path.join(absoluteWorkingDir, '.alinea'),
    watch: options.watch || false
  }

  await copyBoilerplate(context)
  const builds = compileConfig(context)[Symbol.asyncIterator]()
  let nextBuild: Promise<{value: BuildResult; done?: boolean}> = builds.next()
  let afterGenerateCalled = false
  await copyStaticFiles(context)
  while (true) {
    const {done} = await nextBuild
    if (done) break
    nextBuild = builds.next()
    const config = await loadConfig(context)
    try {
      await generatePackage(context, config)
      for await (const store of fillCache(context, config, nextBuild)) {
        yield {config, store}
        if (onAfterGenerate && !afterGenerateCalled) {
          afterGenerateCalled = true
          onAfterGenerate()
        }
      }
    } catch (e) {
      console.error(e)
    }
  }
}
