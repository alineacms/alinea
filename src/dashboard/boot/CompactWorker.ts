import {BrowserEntryStore} from '#/database/BrowserEntryStore.js'
import {cacheName} from './DashboardWorker.js'

/** The name of the worker that compacts a stored base. */
export const compactWorkerName = 'Alinea compaction'

/** A compaction that has not answered by then is given up. */
const compactTimeout = 120_000

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
 * dashboard's script. One tab of the browser compacts at a time: others
 * leave it. Resolves to the key of the copy, or undefined if none was
 * stored, such as where workers are not available.
 */
export async function compactInWorker(
  url: string,
  key: string
): Promise<string | undefined> {
  const locks = globalThis.navigator?.locks
  if (!locks) return startCompactWorker(url, key)
  return locks.request('alinea-compact', {ifAvailable: true}, lock =>
    lock ? startCompactWorker(url, key) : undefined
  )
}

function startCompactWorker(
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
      clearTimeout(timeout)
      resolve(compacted)
      worker.terminate()
    }
    const timeout = setTimeout(() => done(undefined), compactTimeout)
    worker.onmessage = event => done(event.data?.compacted)
    worker.onerror = () => done(undefined)
    worker.postMessage({key})
  })
}
