import type {CMS} from '#/core/CMS.js'
import {Config} from '#/core/Config.js'
import {createId} from '#/core/Id.js'
import {genEffect} from '#/core/util/Async.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {basename, join} from '#/core/util/Paths.js'
import * as fsp from 'node:fs/promises'
import {createRequire} from 'node:module'
import path from 'node:path'
import prettyBytes from 'pretty-bytes'
import {compileConfig} from './generate/CompileConfig.js'
import {copyStaticFiles} from './generate/CopyStaticFiles.js'
import type {GeneratedSecrets} from './generate/CopyStaticFiles.js'
import {DevDB} from './generate/DevDB.js'
import {loadDevCheckpoint} from './generate/DevCheckpoint.js'
import {fillCache} from './generate/FillCache.js'
import type {GenerateContext} from './generate/GenerateContext.js'
import {generateDashboard} from './generate/GenerateDashboard.js'
import {dirname} from './util/Dirname.js'
import type {Emitter} from './util/Emitter.js'
import {findConfigFile} from './util/FindConfigFile.js'
import {reportError, reportFatal} from './util/Report.js'
import {buildEntryReleaseArtifacts} from '#/database/release/Artifacts.js'

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
    bundleDir: path.join(nodeModules, '@alinea/generated')
  }
  const generated = {releaseId: createId(), configId: createId()}
  await copyStaticFiles(context, {preserveRuntimeIndex: cmd === 'dev'})
  let indexing!: Emitter<DevDB>
  const builder = compileConfig(context)
  const builds = genEffect(builder, () => indexing?.return())
  let afterGenerateCalled = false

  async function writeRelease(db: DevDB, cms: CMS, configHash: string) {
    const artifacts = await buildEntryReleaseArtifacts(cms.config, db.source, {
      releaseId: generated.releaseId,
      configId: generated.configId,
      snapshot: db.normalizedSnapshot
    })
    const publicDir = path.join(rootDir, cms.config.publicDir ?? 'public')
    const payloadDir = path.join(publicDir, artifacts.payloadPath)
    const configDir = path.join(publicDir, artifacts.configPath)
    const runtimeIndex =
      cmd === 'dev'
        ? {
            ...artifacts.runtime.index,
            development: {
              configHash,
              files: db.source.snapshot().files
            }
          }
        : artifacts.runtime.index
    const directories = [fsp.mkdir(payloadDir, {recursive: true})]
    if (cmd === 'build')
      directories.push(fsp.mkdir(configDir, {recursive: true}))
    await Promise.all(directories)
    await Promise.all([
      fsp.writeFile(
        path.join(payloadDir, 'payload.bundle'),
        artifacts.runtime.bundle
      ),
      fsp.writeFile(
        path.join(context.bundleDir, 'runtime-index.js'),
        `export default ${JSON.stringify(runtimeIndex)}`
      )
    ])
    if (cmd === 'dev')
      db.installCheckpoint({
        index: runtimeIndex,
        payloadFile: path.join(payloadDir, 'payload.bundle')
      })
    return artifacts.runtime.bundle.length
  }
  for await (const cms of builds) {
    const configHash = await hashBlob(
      await fsp.readFile(path.join(context.bundleDir, 'server-config.js'))
    )
    const adminPath = Config.adminPath(cms.config)
    process.env.ALINEA_ADMIN_PATH = adminPath
    process.env.ALINEA_GENERATED_RELEASE = generated.releaseId
    process.env.ALINEA_GENERATED_CONFIG = generated.configId
    process.env.ALINEA_RELEASE_URL = `${adminPath}/${generated.releaseId}/payload.bundle`
    process.env.ALINEA_CONFIG_URL = `${adminPath}/config/${generated.configId}/client-config.js`
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
    const write = async (recordCount: number, persist: boolean) => {
      let dbSize = 0
      if (cmd === 'build') {
        const sizes = await Promise.all([
          generatePackage(context, cms, generated),
          writeRelease(db, cms, configHash)
        ])
        dbSize = sizes[1]
      } else if (persist) {
        dbSize = await writeRelease(db, cms, configHash)
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
    const checkpoint =
      cmd === 'dev'
        ? await loadDevCheckpoint(context, cms.config, configHash)
        : undefined
    const db = new DevDB({
      config: cms.config,
      rootDir,
      dashboardUrl: await options.dashboardUrl,
      checkpoint
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
      const shouldReport = Boolean(onAfterGenerate && !afterGenerateCalled)
      const shouldPersist = cmd === 'build' || db.needsCheckpoint
      if (shouldReport || shouldPersist) {
        const recordCount = await db.count({})
        await write(recordCount ?? 0, shouldPersist).then(
          message => {
            if (shouldPersist) db.checkpointWritten()
            if (shouldReport) {
              afterGenerateCalled = true
              onAfterGenerate!(message, cms.config)
            }
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
