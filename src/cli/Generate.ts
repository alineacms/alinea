import type {CMS} from '#/core/CMS.js'
import {Config} from '#/core/Config.js'
import {createId, validateId} from '#/core/Id.js'
import {exportSourcePack} from '#/core/source/SourcePack.js'
import {genEffect} from '#/core/util/Async.js'
import {isRecord} from '#/core/util/Objects.js'
import {basename, join} from '#/core/util/Paths.js'
import * as fsp from 'node:fs/promises'
import {createRequire} from 'node:module'
import path from 'node:path'
import prettyBytes from 'pretty-bytes'
import {compileConfig} from './generate/CompileConfig.js'
import {prepareOutputDirectory} from './generate/CopyStaticFiles.js'
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
  onAfterGenerate?: (
    buildMessage: string,
    config: Config,
    release: GeneratedRelease
  ) => void
  dashboardUrl?: Promise<string>
}

export interface GeneratedRelease {
  configId: string
  sourceId: string
}

async function generatePackage(
  context: GenerateContext,
  cms: CMS,
  configId: string
) {
  const {config} = cms
  const {htmlFile} = Config.dashboardPaths(config)
  const staticFile = join(config.publicDir, htmlFile)
  await generateDashboard(
    context,
    cms,
    config.handlerUrl ?? '/api/cms',
    staticFile,
    configId
  )
  return basename(staticFile)
}

export async function* generate(options: GenerateOptions): AsyncGenerator<
  {
    cms: CMS
    db: DevDB
    release: GeneratedRelease
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
  const release: GeneratedRelease = {
    configId: createId(),
    sourceId: createId()
  }

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
    outDir: path.join(nodeModules, '.alinea')
  }
  await prepareOutputDirectory(context)
  let indexing!: Emitter<DevDB>
  const builder = compileConfig(context)
  const builds = genEffect(builder, () => indexing?.return())
  let afterGenerateCalled = false

  async function writeStore(db: DevDB) {
    const data = await exportSourcePack(db.source)
    const {assetsDir} = Config.dashboardPaths(db.config)
    const sourceName = 'source.pack'
    const sourceDirectory = path.join(
      context.rootDir,
      db.config.publicDir ?? '/public',
      assetsDir,
      'release',
      release.sourceId
    )
    const sourceLocation = path.join(sourceDirectory, sourceName)
    await fsp.mkdir(sourceDirectory, {recursive: true})
    await fsp.writeFile(sourceLocation, data)
    return data.byteLength
  }
  async function cleanReleaseArtifacts(config: Config) {
    const {assetsDir} = Config.dashboardPaths(config)
    const assetsDirectory = path.resolve(
      path.join(context.rootDir, config.publicDir ?? '/public', assetsDir)
    )
    const releaseDirectory = path.join(assetsDirectory, 'release')
    const rootDirectory = path.resolve(context.rootDir)
    if (!assetsDirectory.startsWith(`${rootDirectory}${path.sep}`))
      throw new Error('Alinea release directory must be inside the project')
    const existing = await fsp
      .readdir(releaseDirectory, {withFileTypes: true})
      .catch(error => {
        if (isRecord(error) && error.code === 'ENOENT') return []
        throw error
      })
    await Promise.all(
      existing
        .filter(entry => entry.isDirectory() && validateId(entry.name))
        .map(entry =>
          fsp.rm(path.join(releaseDirectory, entry.name), {
            recursive: true,
            force: true
          })
        )
    )
    const legacy = await fsp
      .readdir(assetsDirectory, {withFileTypes: true})
      .catch(error => {
        if (isRecord(error) && error.code === 'ENOENT') return []
        throw error
      })
    await Promise.all(
      legacy
        .filter(
          entry =>
            entry.isFile() && /^source-[0-9A-Za-z]{27}\.json$/.test(entry.name)
        )
        .map(entry => fsp.rm(path.join(assetsDirectory, entry.name)))
    )
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
        await cleanReleaseArtifacts(db.config)
        ;[, dbSize] = await Promise.all([
          generatePackage(context, cms, release.configId),
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
      yield {cms, db, release}
      if (onAfterGenerate && !afterGenerateCalled) {
        const recordCount = await db.count({})
        await write(recordCount ?? 0).then(
          message => {
            afterGenerateCalled = true
            onAfterGenerate(message, cms.config, release)
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
