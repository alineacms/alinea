import {Database} from 'alinea/backend/Database'
import {Store} from 'alinea/backend/Store'
import {Emitter, createEmitter} from 'alinea/cli/util/Emitter'
import {Config} from 'alinea/core/Config'
import pLimit from 'p-limit'
import {getCommitSha} from '../util/CommitSha.js'
import {createWatcher} from '../util/Watcher.js'
import {GenerateContext} from './GenerateContext.js'
import {LocalData} from './LocalData.js'

const dbCache = new WeakMap<Config, Database>()

export async function* fillCache(
  {watch, rootDir}: GenerateContext,
  localData: LocalData,
  store: Store,
  config: Config,
  until: Promise<any>
): AsyncGenerator<Database> {
  const db = dbCache.has(config)
    ? dbCache.get(config)!
    : new Database(config, store)
  dbCache.set(config, db)
  const limit = pLimit(1)
  const commitSha = getCommitSha()

  const cache = async () => {
    await db.fill(localData, commitSha ?? '', localData)
    return db
  }

  yield limit(cache)

  if (!watch || !localData.watchFiles) return

  const results = createEmitter<Promise<Database>>()
  const stopWatching = await createWatcher({
    watchFiles: localData.watchFiles.bind(localData),
    async onChange() {
      results.emit(limit(cache))
    }
  })
  until.then(() => {
    results.cancel()
  })

  try {
    for await (const result of results) yield result
  } catch (e) {
    if (e === Emitter.CANCELLED) return
    throw e
  } finally {
    stopWatching()
  }
}
