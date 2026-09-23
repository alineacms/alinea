import type {CMS} from '#/core/CMS.js'
import {Config} from '#/core/Config.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {genEffect} from '#/core/util/Async.js'
import {basename, join} from '#/core/util/Paths.js'
import {generatedDatabaseFile} from '#/database/Version.js'
import {createRequire} from 'node:module'
import * as fsp from 'node:fs/promises'
import path from 'node:path'
import prettyBytes from 'pretty-bytes'
import {compileConfig} from './generate/CompileConfig.js'
import {
  cleanupOldDatabases,
  copyStaticFiles
} from './generate/CopyStaticFiles.js'
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
  const staticFile = join(config.publicDir, Config.dashboardFile(config))
  await generateDashboard(context, cms, Config.handlerUrl(config), staticFile)
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
    watch = cmd === 'dev',
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

  // One database serves the whole session: a changed config derives the
  // entries again in place instead of closing and reopening the file.
  let db: DevDB | undefined
  let databaseReady = false
  try {
    for await (const cms of builds) {
      Config.handlerUrl(cms.config)
      if (cmd === 'build') {
        const baseUrl = Config.baseUrl(cms.config, 'production')
        if (!baseUrl) {
          reportFatal(
            'No baseUrl was set for the production build in Alinea config'
          )
          process.exit(1)
        }
      }
      // The dashboard bundles while the entries are indexed; a failure is
      // reported when the build writes its files.
      const dashboard =
        cmd === 'build' && !afterGenerateCalled && generatePackage(context, cms)
      if (dashboard) dashboard.catch(() => {})
      const databaseOptions = {
        config: cms.config,
        rootDir,
        databasePath: join(context.outDir, generatedDatabaseFile),
        configFingerprint: await hashBlob(
          await fsp.readFile(join(context.outDir, 'config.js'))
        ),
        dashboardUrl: await options.dashboardUrl
      }
      try {
        if (db) await db.reconfigure(databaseOptions)
        else db = await DevDB.create(databaseOptions)
      } catch (error) {
        if (error instanceof Error) reportError(error)
        if (cmd === 'build') process.exit(1)
        continue
      }
      const current = db
      const write = async (recordCount: number) => {
        let dbSize = 0
        if (dashboard)
          [, dbSize] = await Promise.all([dashboard, current.finalize()])
        let message = `${cmd} ${location} in `
        const duration = performance.now() - now
        if (duration > 1000) message += `${(duration / 1000).toFixed(2)}s`
        else message += `${duration.toFixed(0)}ms`
        const details = [`${recordCount} records`]
        if (dbSize > 0) details.unshift(`db ${prettyBytes(dbSize)}`)
        if (current.hydrated)
          details.push(`hydrated, ${current.lastSyncChanges} changed`)
        message += ` (${details.join(', ')})`
        return message
      }
      try {
        indexing = fillCache(current, context.fix, watch)
      } catch (error) {
        if (error instanceof Error) reportError(error)
        if (cmd === 'build') process.exit(1)
        continue
      }
      for await (const db of indexing) {
        databaseReady = true
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
  } finally {
    try {
      await db?.close()
    } finally {
      if (databaseReady) await cleanupOldDatabases(context.outDir)
    }
  }
}
