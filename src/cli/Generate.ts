import type {CMS} from '#/core/CMS.js'
import {Config} from '#/core/Config.js'
import {MediaLocation} from '#/core/media/MediaLocation.js'
import {getScope} from '#/core/Scope.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {genEffect} from '#/core/util/Async.js'
import {basename, join} from '#/core/util/Paths.js'
import * as fsp from 'node:fs/promises'
import path from 'node:path'
import prettyBytes from 'pretty-bytes'
import {compileConfig} from './generate/CompileConfig.js'
import {copyStaticFiles} from './generate/CopyStaticFiles.js'
import {DevDB} from './generate/DevDB.js'
import {fillCache} from './generate/FillCache.js'
import type {GenerateContext} from './generate/GenerateContext.js'
import {generatedPaths} from './generate/GeneratedPaths.js'
import {generateDashboard} from './generate/GenerateDashboard.js'
import {linkMediaFiles} from './generate/LinkMediaFiles.js'
import {remoteLocations} from './generate/MediaLocations.js'
import {dirname} from './util/Dirname.js'
import type {Emitter} from './util/Emitter.js'
import {findConfigFile} from './util/FindConfigFile.js'
import {reportError, reportFatal, reportWarning} from './util/Report.js'

const __dirname = dirname(import.meta.url)

export interface GenerateOptions {
  cmd: 'dev' | 'build'
  cwd?: string
  staticDir?: string
  configFile?: string
  watch?: boolean
  fix?: boolean
  wasmCache?: boolean
  quiet?: boolean
  onAfterGenerate?: (
    buildMessage: string,
    config: Config,
    databasePath: string
  ) => void
  dashboardUrl?: Promise<string>
}

async function generatePackage(
  context: GenerateContext,
  cms: CMS,
  configFingerprint: string
) {
  const {config} = cms
  const staticFile = join(config.publicDir, Config.dashboardFile(config))
  await generateDashboard(
    context,
    cms,
    Config.handlerUrl(config),
    staticFile,
    configFingerprint
  )
  return basename(staticFile)
}

export async function* generate(options: GenerateOptions): AsyncGenerator<
  {
    cms: CMS
    db: DevDB
    configFingerprint: string
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

  const {packageDir, outDir, databasePath} = generatedPaths({
    rootDir,
    configLocation
  })

  const context: GenerateContext = {
    cmd,
    wasmCache,
    rootDir: rootDir,
    staticDir,
    quiet,
    configDir,
    configLocation,
    fix: options.fix || false,
    packageDir,
    outDir
  }
  await copyStaticFiles(context)
  let indexing!: Emitter<DevDB>
  const builder = compileConfig(context)
  const builds = genEffect(builder, () => indexing?.return())
  let afterGenerateCalled = false

  // One database serves the whole session: a changed config derives the
  // entries again in place instead of closing and reopening the file.
  let db: DevDB | undefined
  try {
    for await (const cms of builds) {
      Config.handlerUrl(cms.config)
      if (cmd === 'build') {
        try {
          Config.serverHandlerUrl(cms.config, 'production')
        } catch (error) {
          reportFatal(error instanceof Error ? error.message : String(error))
          process.exit(1)
        }
      }
      const configFingerprint = await hashBlob(
        await fsp.readFile(join(context.outDir, 'config.js'))
      )
      // The dashboard bundles while the entries are indexed; a failure is
      // reported when the build writes its files.
      const dashboard =
        cmd === 'build' &&
        !afterGenerateCalled &&
        generatePackage(context, cms, configFingerprint)
      if (dashboard) dashboard.catch(() => {})
      const databaseOptions = {
        config: cms.config,
        rootDir,
        databasePath,
        configFingerprint,
        dashboardUrl: await options.dashboardUrl
      }
      try {
        if (db) {
          // The handler of the previous config answers until the next one is
          // served, its queries are compiled against the next config
          getScope(cms.config).adopt(getScope(db.config))
          await db.reconfigure(databaseOptions)
        } else {
          db = await DevDB.create(databaseOptions)
        }
      } catch (error) {
        if (error instanceof Error) reportError(error)
        if (cmd === 'build') process.exit(1)
        continue
      }
      const current = db
      const write = async (recordCount: number) => {
        let dbSize = 0
        if (dashboard)
          [, dbSize] = await Promise.all([
            dashboard,
            // A build ships the file: lay its tables out in order once
            current.finalize({rewrite: cmd === 'build'}),
            linkMediaFiles(rootDir, current)
          ])
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
        if (!afterGenerateCalled) await warnRemoteLocations(rootDir, db)
        yield {cms, db, configFingerprint}
        if (onAfterGenerate && !afterGenerateCalled) {
          const recordCount = await db.count({})
          await write(recordCount ?? 0).then(
            message => {
              afterGenerateCalled = true
              onAfterGenerate(message, cms.config, databasePath)
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
    await db?.close()
  }
}

async function warnRemoteLocations(rootDir: string, db: DevDB) {
  for (const file of await remoteLocations(rootDir, db)) {
    const mediaDir = MediaLocation.directory(db.config, file.workspace)
    reportWarning(
      `Media file ${file.file} has a url as location, it can't be served`,
      `location: ${file.location}`,
      file.local
        ? `Run \`alinea build --fix\` to point it at ${join(mediaDir, file.local)}`
        : `Point location at the file in ${mediaDir || 'the public dir'}, eg. "/${basename(new URL(file.location).pathname)}"`
    )
  }
}
