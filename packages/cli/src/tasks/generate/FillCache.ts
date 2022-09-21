import {Cache, Data, JsonLoader} from '@alinea/backend'
import {FileData} from '@alinea/backend/data/FileData'
import {Storage} from '@alinea/backend/Storage'
import {createDb} from '@alinea/backend/util/CreateDb'
import {exportStore} from '@alinea/cli/ExportStore'
import {Config} from '@alinea/core/Config'
import {Entry} from '@alinea/core/Entry'
import {createError} from '@alinea/core/ErrorWithCode'
import {outcome} from '@alinea/core/Outcome'
import {Logger} from '@alinea/core/util/Logger'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import {FSWatcher} from 'chokidar'
import fs from 'fs-extra'
import path from 'node:path'
import {Signal, signal} from 'usignal'
import {GenerateContext} from './GenerateContext'

async function createSource({cwd, outDir}: GenerateContext, config: Config) {
  const sources = Object.values(config.workspaces).map(workspace => {
    return workspace.source
  })
  const customSources: Array<Data.Source> = []
  for (const sourceLocation of sources) {
    const [stats, err] = await outcome(fs.stat(path.join(cwd, sourceLocation)))
    if (err || !stats!.isDirectory()) {
      // This whole thing will be tough to support properly
      // let's disable for now
      // Attempt to build and extract source
      /*const tmpFile = path.join(outDir, '_tmp', createId() + '.js')
      await failOnBuildError(
        build({
          platform: 'node',
          bundle: true,
          format: 'esm',
          target: 'esnext',
          treeShaking: true,
          outfile: tmpFile,
          entryPoints: [sourceLocation],
          absWorkingDir: outDir,
          jsx: 'automatic',
          plugins: [externalPlugin(cwd), ignorePlugin]
        })
      )
      const outFile = 'file://' + tmpFile
      const exports = await import(outFile).finally(() => fs.unlink(tmpFile))
      customSources.push(exports.default || exports.source)*/
    }
  }
  const files = new FileData({
    config,
    fs: fs.promises,
    loader: JsonLoader,
    rootDir: cwd
  })
  return customSources.length > 0
    ? Data.Source.concat(files, ...customSources)
    : files
}

interface FillResult {
  result: Signal<SqliteStore>
  stop: () => Promise<void>
}

async function cacheEntries(
  {quiet, fix}: GenerateContext,
  config: Config,
  source: Data.Source
) {
  const store = await createDb()
  await Cache.create({
    store,
    config,
    from: source,
    logger: quiet ? undefined : new Logger('Generate')
  })
  return store
}

function exportToFile(
  {outDir, wasmCache}: GenerateContext,
  store: SqliteStore
) {
  return exportStore(store, path.join(outDir, 'store.js'), wasmCache)
}

export async function fillCache(
  context: GenerateContext,
  config: Config
): Promise<FillResult> {
  const source = await createSource(context, config)
  const files = await source.watchFiles?.()
  async function cache() {
    const store = await cacheEntries(context, config, source)
    await exportToFile(context, store)
    if (context.fix) {
      if (!(source instanceof FileData))
        throw createError(`Cannot fix custom sources`)
      const changes = await Storage.publishChanges(
        config,
        store,
        JsonLoader,
        store.all(Entry),
        true
      )
      source.publish({changes})
    }
    return store
  }
  const result = signal(await cache())
  if (!context.watch || !files)
    return {
      result,
      stop: async () => {}
    }

  const watcher = new FSWatcher()
  watcher.add(files)
  const reload = async () => {
    result.value = await cache()
  }
  watcher.on('change', reload)
  watcher.on('unlink', reload)
  return {
    result,
    stop() {
      return watcher.close()
    }
  }
}
