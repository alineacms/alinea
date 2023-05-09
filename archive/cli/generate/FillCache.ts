import {Cache, Data, JsonLoader} from 'alinea/backend'
import {Storage} from 'alinea/backend/Storage'
import {FileData} from 'alinea/backend/data/FileData'
import {createDb} from 'alinea/backend/util/CreateDb'
import {exportStore} from 'alinea/cli/ExportStore'
import {Emitter, createEmitter} from 'alinea/cli/util/Emitter'
import {Config} from 'alinea/core/Config'
import {Entry} from 'alinea/core/Entry'
import {createError} from 'alinea/core/ErrorWithCode'
import {outcome} from 'alinea/core/Outcome'
import {Logger} from 'alinea/core/util/Logger'
import {SqliteStore} from 'alinea/store/sqlite/SqliteStore'
import fs from 'fs-extra'
import path from 'node:path'
import pLimit from 'p-limit'
import {createWatcher} from '../util/Watcher.js'
import {GenerateContext} from './GenerateContext.js'

async function createSource({cwd, outDir}: GenerateContext, config: Config) {
  const sources = Object.values(config.workspaces).map(workspace => {
    return workspace.source
  })
  const customSources: Array<Data.Source> = []
  for (const sourceLocation of sources) {
    const [stats, err] = await outcome(fs.stat(path.join(cwd, sourceLocation)))
    if (err || !stats!.isDirectory()) {
      // This whole thing will be though to support properly
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
  return files
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

export async function* fillCache(
  context: GenerateContext,
  store: Store,
  config: Config,
  until: Promise<any>
) {
  const source = await createSource(context, config)
  const files = await source.watchFiles?.()
  const limit = pLimit(1)
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
  const result = await limit(cache)
  yield result
  if (!context.watch || !files) return

  const results = createEmitter<SqliteStore>()

  const stopWatching = await createWatcher(files, async () => {
    results.emit(await limit(cache))
  })
  until.then(() => {
    results.cancel()
  })

  try {
    for await (const store of results) yield store
  } catch (e) {
    if (e === Emitter.CANCELLED) return
    throw e
  } finally {
    stopWatching()
  }
}
