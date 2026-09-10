import {wrap, releaseProxy, type Remote} from 'comlink'
import {WorkerGraph} from '#/database/browser/WorkerGraph.js'
import type {QueryWorker} from '#/database/browser/QueryWorker.js'
import type {ConfigBatch} from './Boot.js'
import type {ReplicaWorkerHost} from './ReplicaWorkerHost.js'
import {GraphSessionAbort} from '#/core/db/GraphSession.js'
import {PendingMutations} from '#/database/browser/PendingMutations.js'

class OwnedWorkerGraph extends WorkerGraph {
  #host: Remote<ReplicaWorkerHost>
  #script: Worker
  #closing?: Promise<void>

  constructor(
    batch: ConfigBatch,
    endpoint: Remote<QueryWorker>,
    host: Remote<ReplicaWorkerHost>,
    script: Worker
  ) {
    super(batch.config, endpoint)
    this.#host = host
    this.#script = script
  }

  close(purge = false): Promise<void> {
    return (this.#closing ??= (async () => {
      try {
        try {
          await super.close(purge)
        } finally {
          await this.#host.close(purge)
        }
      } finally {
        this.#host[releaseProxy]()
        this.#script.terminate()
      }
    })())
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
  const failed = (event: ErrorEvent) => {
    crashed = true
    cancelled.reject(
      new Error(event.message || 'Replica worker startup failed')
    )
  }
  signal.addEventListener('abort', cancel, {once: true})
  worker.addEventListener('error', failed)
  let graph: OwnedWorkerGraph | undefined
  try {
    const endpoint = await Promise.race([
      host.connect(principal, batch.revision),
      cancelled.promise
    ])
    graph = new OwnedWorkerGraph(batch, endpoint, host, worker)
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
      if (!crashed)
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
      if (purge) {
        const pending = await PendingMutations.open(globalThis.indexedDB, {
          ...batch.replica,
          principal,
          endpoint: batch.handlerUrl
        })
        try {
          await pending.purge()
        } finally {
          pending.close()
        }
      }
    }
    throw error
  } finally {
    signal.removeEventListener('abort', cancel)
    worker.removeEventListener('error', failed)
  }
}
