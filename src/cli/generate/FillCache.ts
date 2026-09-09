import pLimit from 'p-limit'
import {type Emitter, createEmitter} from '../util/Emitter.js'
import {reportError} from '../util/Report.js'
import {createWatcher} from '../util/Watcher.js'
import type {DevDB} from './DevDB.js'

export function fillCache(db: DevDB, fix?: boolean): Emitter<DevDB> {
  let canceled = false
  let stopWatching = () => {
    canceled = true
  }

  const results = createEmitter<DevDB>({
    onReturn() {
      canceled = true
      stopWatching()
      void db.close().catch(reportError)
    }
  })

  const limit = pLimit(1)
  const run = () =>
    limit(async () => {
      if (canceled) return
      const db = await cache()
      if (!canceled) results.emit(db)
    }).catch(error => {
      if (!canceled) reportError(error)
    })

  const cache = async () => {
    await db.sync()
    if (fix) await db.fix()
    return db
  }

  createWatcher({
    watchFiles: db.watchFiles.bind(db),
    onChange: run
  }).then(cancel => {
    if (canceled) cancel()
    else stopWatching = cancel
  })

  run()

  return results
}
