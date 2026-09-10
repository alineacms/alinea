import {wrap, releaseProxy, type Remote} from 'comlink'
import {WorkerGraph} from '#/database/browser/WorkerGraph.js'
import type {QueryWorker} from '#/database/browser/QueryWorker.js'
import type {ConfigBatch} from './Boot.js'
import type {ReplicaWorkerHost} from './ReplicaWorkerHost.js'
import {GraphSessionAbort} from '#/core/db/GraphSession.js'
import {PendingMutations} from '#/database/browser/PendingMutations.js'
import {ReplicaCache} from '#/database/browser/ReplicaCache.js'

export class OwnedWorkerGraph extends WorkerGraph {
  #host: Remote<ReplicaWorkerHost>
  #script: Worker
  #closing?: Promise<void>
  #crashed = false
  #purge: () => Promise<void>
  #timeout: number
  #failed = (event: Event) => {
    this.#crashed = true
    this.fail(
      new Error(
        (event instanceof ErrorEvent && event.message) ||
          'Replica worker failed'
      )
    )
    this.#script.terminate()
    void super.close().catch(() => {})
  }

  constructor(
    batch: ConfigBatch,
    endpoint: Remote<QueryWorker>,
    host: Remote<ReplicaWorkerHost>,
    script: Worker,
    purge: () => Promise<void>,
    shutdownTimeout = 5000
  ) {
    super(batch.config, endpoint)
    this.#host = host
    this.#script = script
    this.#purge = purge
    this.#timeout = shutdownTimeout
    script.addEventListener('error', this.#failed)
    script.addEventListener('messageerror', this.#failed)
  }

  close(purge = false): Promise<void> {
    return (this.#closing ??= (async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          (async () => {
            try {
              await super.close(purge)
            } finally {
              if (!this.#crashed) await this.#host.close(purge)
            }
          })(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              const error = new Error('Replica worker cleanup timed out')
              this.#crashed = true
              this.fail(error)
              reject(error)
            }, this.#timeout)
          })
        ])
      } finally {
        clearTimeout(timeout)
        this.#script.removeEventListener('error', this.#failed)
        this.#script.removeEventListener('messageerror', this.#failed)
        this.#host[releaseProxy]()
        this.#script.terminate()
        // Also clear views from earlier worker generations, including a crashed startup.
        if (purge) await this.#purge()
      }
    })())
  }
}

async function purgeWorkerScope(
  batch: ConfigBatch,
  principal: string
): Promise<void> {
  const scope = {...batch.replica, principal}
  try {
    const pending = await PendingMutations.open(globalThis.indexedDB, {
      ...scope,
      endpoint: batch.handlerUrl
    })
    try {
      await pending.purge()
    } finally {
      pending.close()
    }
  } finally {
    await ReplicaCache.purgeScope(globalThis.indexedDB, scope)
  }
}

/** The script is the generated dashboard entry, also usable in worker scope. */
export async function connectReplicaWorker(
  script: URL,
  batch: ConfigBatch,
  principal: string,
  signal: AbortSignal
): Promise<WorkerGraph> {
  signal.throwIfAborted()
  const url = new URL(script)
  url.searchParams.set('configRevision', batch.revision)
  const worker = new Worker(url, {type: 'module', name: 'Alinea SQLite'})
  const host = wrap<ReplicaWorkerHost>(worker)
  const cancelled = Promise.withResolvers<never>()
  let crashed = false
  const cancel = () => cancelled.reject(signal.reason)
  const failed = (event: Event) => {
    crashed = true
    cancelled.reject(
      new Error(
        (event instanceof ErrorEvent && event.message) ||
          'Replica worker startup failed'
      )
    )
  }
  signal.addEventListener('abort', cancel, {once: true})
  worker.addEventListener('error', failed)
  worker.addEventListener('messageerror', failed)
  let graph: OwnedWorkerGraph | undefined
  try {
    const endpoint = await Promise.race([
      host.connect(principal, batch.revision),
      cancelled.promise
    ])
    graph = new OwnedWorkerGraph(batch, endpoint, host, worker, () =>
      purgeWorkerScope(batch, principal)
    )
    await Promise.race([
      Promise.all([graph.listenIndex(), graph.listenActivity()]),
      cancelled.promise
    ])
    signal.throwIfAborted()
    return graph
  } catch (error) {
    const purge =
      signal.reason instanceof GraphSessionAbort && signal.reason.purge
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      if (graph || !crashed)
        await Promise.race([
          graph ? graph.close(purge) : host.close(purge),
          new Promise<void>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error('Replica worker cleanup timed out')),
              5000
            )
          })
        ])
    } finally {
      clearTimeout(timeout)
      if (!graph) host[releaseProxy]()
      worker.terminate()
      if (purge) await purgeWorkerScope(batch, principal)
    }
    throw error
  } finally {
    signal.removeEventListener('abort', cancel)
    worker.removeEventListener('error', failed)
    worker.removeEventListener('messageerror', failed)
  }
}
