import {proxy} from 'comlink'
import {QueryWorker} from '#/database/browser/QueryWorker.js'
import type {ConfigBatch} from './Boot.js'
import type {WritableReplicaOptions} from '#/database/browser/WritableReplica.js'

/** One dedicated worker, one authenticated owner. Scope/config come from the
 * worker's generated batch, never from a caller-supplied bootstrap or database.
 */
export class ReplicaWorkerHost {
  #batch: Promise<ConfigBatch>
  #options: Pick<WritableReplicaOptions, 'indexedDB' | 'fetch' | 'lock'>
  #abort = new AbortController()
  #worker?: QueryWorker
  #opening?: Promise<QueryWorker>
  #principal?: string
  #closed = false
  #purge = false

  constructor(
    batch: ConfigBatch | Promise<ConfigBatch>,
    options: Pick<WritableReplicaOptions, 'indexedDB' | 'fetch' | 'lock'> = {
      indexedDB: globalThis.indexedDB
    }
  ) {
    this.#batch = Promise.resolve(batch)
    // Loading can fail before the first port call. Keep that error for connect.
    void this.#batch.catch(() => {})
    this.#options = options
  }

  async connect(principal: string, revision: string) {
    if (this.#closed) throw new Error('Replica worker host is closed')
    const batch = await this.#batch
    if (this.#closed) throw new Error('Replica worker host is closed')
    if (!principal || revision !== batch.revision)
      throw new Error('Replica worker configuration mismatch')
    if (this.#principal && this.#principal !== principal)
      throw new Error('Replica worker already belongs to another principal')
    this.#principal = principal
    this.#opening ??= QueryWorker.connectWritable({
      ...this.#options,
      config: batch.config,
      url: batch.handlerUrl,
      expected: {...batch.replica, principal},
      signal: this.#abort.signal
    }).then(async worker => {
      if (this.#closed) {
        await worker.close(this.#purge)
        throw new Error('Replica worker host closed during startup')
      }
      this.#worker = worker
      return worker
    })
    return proxy(await this.#opening)
  }

  async close(purge = false): Promise<void> {
    this.#closed = true
    this.#purge ||= purge
    this.#abort.abort(new Error('Replica worker host closed'))
    await this.#opening?.catch(() => {})
    await this.#worker?.close(this.#purge)
  }
}
