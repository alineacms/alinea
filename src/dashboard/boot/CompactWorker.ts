import {BrowserEntryStore} from '#/database/BrowserEntryStore.js'
import {cacheName} from './DashboardWorker.js'

/** The name of the worker that compacts a stored base. */
export const compactWorkerName = 'Alinea compaction'

/**
 * Run as the compaction worker: compact the base it is sent, answer with the
 * key of the copy, then exit, which returns the memory compacting used.
 */
export function runCompactWorker() {
  addEventListener(
    'message',
    async event => {
      const {key} = (event as MessageEvent<{key: string}>).data
      try {
        const compacted = await BrowserEntryStore.compact(
          {name: cacheName},
          key
        )
        postMessage({compacted})
      } catch (error) {
        postMessage({error: String(error)})
      } finally {
        globalThis.close()
      }
    },
    {once: true}
  )
}

/**
 * Compact base `key` in a worker of its own, started from `url`, the
 * dashboard's script. Resolves to the key of the copy, or undefined if none
 * was stored, such as where workers are not available.
 */
export function compactInWorker(
  url: string,
  key: string
): Promise<string | undefined> {
  return new Promise(resolve => {
    let worker: Worker
    try {
      worker = new Worker(url, {type: 'module', name: compactWorkerName})
    } catch {
      return resolve(undefined)
    }
    const done = (compacted: string | undefined) => {
      resolve(compacted)
      worker.terminate()
    }
    worker.onmessage = event => done(event.data?.compacted)
    worker.onerror = () => done(undefined)
    worker.postMessage({key})
  })
}
