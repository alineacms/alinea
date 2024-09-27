import {Database} from 'alinea/backend/Database'
import {Store} from 'alinea/backend/Store'
import {Config} from 'alinea/core/Config'
import pLimit from 'p-limit'
import {getCommitSha} from '../util/CommitSha.js'
import {createEmitter, Emitter} from '../util/Emitter.js'
import {createWatcher} from '../util/Watcher.js'
import {GenerateContext} from './GenerateContext.js'
import {LocalData} from './LocalData.js'

const dbCache = new WeakMap<Config, Database>()

export function fillCache(
  {fix}: GenerateContext,
  localData: LocalData,
  store: Store,
  config: Config
): Emitter<Database> {
  let canceled = false
  let stopWatching = () => {
    canceled = true
  }

  const results = createEmitter<Database>({
    onReturn() {
      stopWatching()
    }
  })

  const run = () => limit(cache).then(results.emit, results.throw)

  const db = dbCache.has(config)
    ? dbCache.get(config)!
    : new Database(config, store)
  dbCache.set(config, db)
  const limit = pLimit(1)
  const commitSha = getCommitSha()

  const cache = async () => {
    await db.fill(localData, commitSha ?? '', localData, fix)
    return db
  }

  createWatcher({
    watchFiles: localData.watchFiles.bind(localData),
    onChange: run
  }).then(cancel => {
    if (canceled) cancel()
    else stopWatching = cancel
  })

  run()

  return results
}
