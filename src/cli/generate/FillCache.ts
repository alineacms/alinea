import {Database} from 'alinea/backend/Database'
import {Store} from 'alinea/backend/Store'
import {Emitter, createEmitter} from 'alinea/cli/util/Emitter'
import {Config} from 'alinea/core'
import pLimit from 'p-limit'
import {createWatcher} from '../util/Watcher.js'
import {GenerateContext} from './GenerateContext.js'
import {LocalData} from './LocalData.js'

export async function* fillCache(
  {watch, rootDir}: GenerateContext,
  localData: LocalData,
  store: Store,
  config: Config,
  until: Promise<any>
) {
  const db = new Database(store, config)
  const limit = pLimit(1)
  const cache = () => db.fill(localData, localData)

  yield limit(cache)

  if (!watch || !localData.watchFiles) return

  const results = createEmitter<Promise<void>>()
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
    yield* results
  } catch (e) {
    if (e === Emitter.CANCELLED) return
    throw e
  } finally {
    stopWatching()
  }
}
