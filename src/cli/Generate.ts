import * as fsp from 'node:fs/promises'
import {createRequire} from 'node:module'
import path from 'node:path'
import type {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {exportSource} from 'alinea/core/source/SourceExport'
import {genEffect} from 'alinea/core/util/Async'
import {basename, join} from 'alinea/core/util/Paths'
import prettyBytes from 'pretty-bytes'
import {compileConfig} from './generate/CompileConfig.js'
import {copyStaticFiles} from './generate/CopyStaticFiles.js'
import {DevDB} from './generate/DevDB.js'
import {fillCache} from './generate/FillCache.js'
import type {GenerateContext} from './generate/GenerateContext.js'
import {generateDashboard} from './generate/GenerateDashboard.js'
import {dirname} from './util/Dirname.js'
import type {Emitter} from './util/Emitter.js'
import {findConfigFile} from './util/FindConfigFile.js'
import {reportError, reportFatal} from './util/Report.js'

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
  onAfterGenerate?: (buildMessage: string, config: Config) => void
  dashboardUrl?: Promise<string>
}

async function generatePackage(context: GenerateContext, cms: CMS) {
  const {config} = cms
  if (!config.dashboardFile) return
  const staticFile = config.dashboardFile
    ? join(config.publicDir, config.dashboardFile)
    : undefined
  if (!staticFile) return
  await generateDashboard(
    context,
    cms,
    config.handlerUrl ?? '/api/cms',
    staticFile
  )
  return basename(staticFile)
}

export async function* generate(options: GenerateOptions): AsyncGenerator<
  {
    cms: CMS
    db: DevDB
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
  if (!configLocation) throw new Error('No config file specified')
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
  let indexing!: Emitter<DevDB>
  const builder = compileConfig(context)
  const builds = genEffect(builder, () => indexing?.return())
  let afterGenerateCalled = false

  async function writeStore(db: DevDB) {
    const exported = await exportSource(db.source)
    const data = JSON.stringify(exported, null, 2)
    await fsp.writeFile(
      join(context.outDir, 'source.js'),
      `export const source = ${data}`
    )
    return data.length
  }
  for await (const cms of builds) {
    if (cmd === 'build') {
      const handlerUrl = cms.config.handlerUrl
      const baseUrl = Config.baseUrl(cms.config, 'production')
      if (handlerUrl && !baseUrl) {
        reportFatal(
          'No baseUrl was set for the production build in Alinea config'
        )
        process.exit(1)
      }
    }
    const write = async (recordCount: number) => {
      let dbSize = 0
      if (cmd === 'build') {
        ;[, dbSize] = await Promise.all([
          generatePackage(context, cms),
          writeStore(db)
        ])
      }
      let message = `${cmd} ${location} in `
      const duration = performance.now() - now
      if (duration > 1000) message += `${(duration / 1000).toFixed(2)}s`
      else message += `${duration.toFixed(0)}ms`
      if (dbSize > 0)
        message += ` (db ${prettyBytes(dbSize)}, ${recordCount} records)`
      else message += ` (${recordCount} records)`
      return message
    }
    const db = new DevDB({
      config: cms.config,
      rootDir,
      dashboardUrl: await options.dashboardUrl
    })
    try {
      indexing = fillCache(db, context.fix)
    } catch (error: any) {
      reportError(error)
      if (cmd === 'build') process.exit(1)
      continue
    }
    for await (const db of indexing) {
      yield {cms, db}
      if (onAfterGenerate && !afterGenerateCalled) {
        const recordCount = await db.count({})
        await write(recordCount ?? 0).then(
          message => {
            afterGenerateCalled = true
            onAfterGenerate(message, cms.config)
          },
          () => {
            reportFatal('Alinea failed to write dashboard files')
            if (cmd === 'build') process.exit(1)
          }
        )
      }
    }
  }
}
