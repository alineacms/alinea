import pLimit from 'p-limit'
import {type Emitter, createEmitter} from '../util/Emitter.js'
import {reportError} from '../util/Report.js'
import {createWatcher} from '../util/Watcher.js'
import type {DevDB} from './DevDB.js'

export function fillCache(
  db: DevDB,
  fix?: boolean,
  watch = true
): Emitter<DevDB> {
  let canceled = false
  let stopWatching = () => {
    canceled = true
  }

  const results = createEmitter<DevDB>({
    onReturn() {
      stopWatching()
    }
  })

  const limit = pLimit(1)
  const run = () =>
    limit(cache).then(
      db => {
        results.emit(db)
        if (!watch) results.return()
      },
      error => {
        if (watch) reportError(error)
        else results.throw(error)
      }
    )

  const cache = async () => {
    await db.sync()
    if (fix) await db.fix()
    return db
  }

  if (watch) {
    createWatcher({
      watchFiles: db.watchFiles.bind(db),
      onChange: run
    }).then(cancel => {
      if (canceled) cancel()
      else stopWatching = cancel
    })
  }

  run()

  return results
}
