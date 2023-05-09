import {Config} from 'alinea/core/Config'
import {BuildResult} from 'esbuild'
import path from 'node:path'
import {compileConfig} from './generate/CompileConfig.js'
import {copyStaticFiles} from './generate/CopyStaticFiles.js'
import {fillCache} from './generate/FillCache.js'
import {GenerateContext} from './generate/GenerateContext.js'
import {generateDashboard} from './generate/GenerateDashboard.js'
import {generateSchema} from './generate/GenerateSchema.js'
import {loadConfig} from './generate/LoadConfig.js'
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

  const builds = compileConfig(context)[Symbol.asyncIterator]()
  let nextBuild: Promise<{value: BuildResult; done?: boolean}> = builds.next()
  let afterGenerateCalled = false
  await copyStaticFiles(context)
  while (true) {
    const {done} = await nextBuild
    const config = await loadConfig(context)
    await generatePackage(context, config)
    nextBuild = builds.next()
    for await (const store of fillCache(context, config, nextBuild)) {
      yield {config, store}
      if (onAfterGenerate && !afterGenerateCalled) {
        afterGenerateCalled = true
        onAfterGenerate()
      }
    }
    if (done) break
  }
}
