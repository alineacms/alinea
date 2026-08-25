import type {CMS} from '#/core/CMS.js'
import {Config} from '#/core/Config.js'
import {createId} from '#/core/Id.js'
import {exportSource} from '#/core/source/SourceExport.js'
import {genEffect} from '#/core/util/Async.js'
import {basename, join} from '#/core/util/Paths.js'
import * as fsp from 'node:fs/promises'
import path from 'node:path'
import prettyBytes from 'pretty-bytes'
import {compileConfig} from './generate/CompileConfig.js'
import {copyStaticFiles} from './generate/CopyStaticFiles.js'
import type {GeneratedSecrets} from './generate/CopyStaticFiles.js'
import {DevDB} from './generate/DevDB.js'
import {fillCache} from './generate/FillCache.js'
import type {GenerateContext} from './generate/GenerateContext.js'
import {generateDashboard} from './generate/GenerateDashboard.js'
import {dirname} from './util/Dirname.js'
import type {Emitter} from './util/Emitter.js'
import {findConfigFile} from './util/FindConfigFile.js'
import {writeFileIfContentsDiffer} from './util/FS.js'
import {reportError, reportFatal} from './util/Report.js'
import {buildEntryReleaseArtifacts} from '#/database/release/Artifacts.js'

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
  onAfterGenerate?: (buildMessage: string, config: Config) => void
  dashboardUrl?: Promise<string>
}

async function generatePackage(
  context: GenerateContext,
  cms: CMS,
  generated: GeneratedSecrets
) {
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
    staticFile,
    generated.configId
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

  const context: GenerateContext = {
    cmd,
    wasmCache,
    rootDir: rootDir,
    staticDir,
    quiet,
    configDir,
    configLocation,
    fix: options.fix || false,
    outDir: path.join(rootDir, '.alinea', 'generated')
  }
  const generated = {releaseId: createId(), configId: createId()}
  await copyStaticFiles(context, generated)
  let indexing!: Emitter<DevDB>
  const builder = compileConfig(context)
  const builds = genEffect(builder, () => indexing?.return())
  let afterGenerateCalled = false

  async function writeStore(db: DevDB) {
    const exported = await exportSource(db.source)
    const data = JSON.stringify(exported, null, 2)
    await fsp.writeFile(join(context.outDir, 'source.json'), data)
    return data.length
  }
  async function writeRelease(db: DevDB, cms: CMS) {
    const artifacts = await buildEntryReleaseArtifacts(cms.config, db.source, {
      releaseId: generated.releaseId,
      configId: generated.configId
    })
    const publicDir = path.join(rootDir, cms.config.publicDir ?? 'public')
    const releaseDir = path.join(publicDir, artifacts.releasePath)
    const configDir = path.join(publicDir, artifacts.configPath)
    await Promise.all([
      fsp.mkdir(releaseDir, {recursive: true}),
      fsp.mkdir(configDir, {recursive: true})
    ])
    await Promise.all([
      fsp.writeFile(
        path.join(releaseDir, 'database.bin'),
        artifacts.release.bundle.contents
      ),
      fsp.writeFile(
        path.join(releaseDir, 'catalog.json'),
        artifacts.catalogJson
      ),
      fsp.writeFile(
        path.join(context.outDir, 'replica-keys.json'),
        artifacts.handlerKeysJson
      ),
      fsp.writeFile(
        path.join(context.outDir, 'replica-catalog.json'),
        artifacts.catalogJson
      ),
      fsp.writeFile(
        path.join(context.outDir, 'release-meta.json'),
        JSON.stringify(
          {
            releaseId: generated.releaseId,
            releaseUrl: artifacts.releaseUrl,
            configId: generated.configId,
            configUrl: artifacts.configUrl
          },
          null,
          2
        )
      )
    ])
    return artifacts.release.bundle.contents.length
  }
  for await (const cms of builds) {
    await writeFileIfContentsDiffer(
      join(context.outDir, 'settings.json'),
      JSON.stringify(
        {
          adminPath: Config.adminPath(cms.config),
          releaseId: generated.releaseId,
          configId: generated.configId
        },
        null,
        2
      )
    )
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
        const sizes = await Promise.all([
          generatePackage(context, cms, generated),
          writeStore(db),
          writeRelease(db, cms)
        ])
        dbSize = sizes[2]
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
