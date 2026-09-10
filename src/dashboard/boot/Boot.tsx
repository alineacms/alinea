import type {Client} from '#/core/Client.js'
import type {Config} from '#/core/Config.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {IndexedDBSource} from '#/core/source/IndexedDBSource.js'
import * as Comlink from 'comlink'
import type {ComponentType} from 'react'
import {createRoot} from 'react-dom/client'
import {App} from '../App.js'
import {ActivityEvent} from '#/core/db/ActivityEvent.js'
import {DashboardWorker} from './DashboardWorker.js'
import {loadWorker, loadReplicaWorker} from './LoadWorker.js'
import {WorkerDB} from './WorkerDB.js'
import type {ReplicaBinding} from './ReplicaBinding.js'
import {ReplicaGraph} from './ReplicaGraph.js'
import {connectReplicaWorker} from './ConnectReplicaWorker.js'
import {WritableReplica} from '#/database/browser/WritableReplica.js'

export interface ConfigBatch {
  local: boolean
  revision: string
  config: Config
  client: Client
  replica: ReplicaBinding
  handlerUrl: string
  views: Record<string, ComponentType>
  alineaDev?: boolean
}

export type ConfigGenerator = AsyncGenerator<ConfigBatch>

export async function boot(gen: ConfigGenerator) {
  const inWorker = isWorkerScope()
  if (inWorker) {
    if (
      typeof SharedWorkerGlobalScope !== 'undefined' &&
      globalThis instanceof SharedWorkerGlobalScope
    )
      await loadWorker(gen)
    else await loadReplicaWorker(gen)
  } else {
    let events: EventTarget | undefined
    let worker: DashboardWorker | undefined
    let replica: ReplicaGraph | undefined
    addEventListener('pagehide', () => {
      void replica?.close().catch(() => {})
    })
    addEventListener('pageshow', event => {
      if (event instanceof PageTransitionEvent && event.persisted)
        location.reload()
    })
    const scripts = document.getElementsByTagName('script')
    const element = scripts[scripts.length - 1]
    const into = document.createElement('div')
    into.id = 'root'
    if (element.parentElement === document.head) document.body.append(into)
    else element.parentElement!.replaceChild(into, element)
    const root = createRoot(into)
    let lastRevision: string | undefined
    for await (const batch of gen) {
      if (batch.local && batch.revision !== lastRevision) {
        const link = document.querySelector(
          'link[href="config.css"]'
        ) as HTMLLinkElement
        const copy = link.cloneNode() as HTMLLinkElement
        copy.href = `config.css?${batch.revision}`
        copy.onload = () => link.remove()
        link.after(copy)
      }
      if (batch.local) {
        if (batch.revision !== lastRevision) {
          await replica?.close()
          replica = new ReplicaGraph({
            config: batch.config,
            connect(principal, signal) {
              if (typeof Worker !== 'undefined')
                return connectReplicaWorker(
                  new URL(import.meta.url),
                  batch,
                  principal,
                  signal
                )
              return WritableReplica.connect({
                config: batch.config,
                url: batch.handlerUrl,
                expected: {...batch.replica, principal},
                indexedDB: globalThis.indexedDB,
                signal
              })
            }
          })
          root.render(
            <App
              key={batch.revision}
              graph={replica}
              events={replica.events}
              {...batch}
            />
          )
        } else await replica?.sync().catch(() => {})
        lastRevision = batch.revision
        continue
      }
      if (!worker) {
        try {
          ;[events, worker] = createSharedWorker()
        } catch {
          const source = new IndexedDBSource(globalThis.indexedDB, 'alinea')
          events = worker = new DashboardWorker(source)
        }
      }
      const isLocal = worker instanceof DashboardWorker
      if (isLocal) await worker.load(batch.revision, batch.config, batch.client)
      if (batch.revision !== lastRevision) {
        const db = new WorkerDB(batch.config, worker, batch.client, events!)
        root.render(
          <App key={batch.revision} graph={db} events={events!} {...batch} />
        )
      }
      lastRevision = batch.revision
    }
  }
}

function createSharedWorker(): [EventTarget, DashboardWorker] {
  const events = new EventTarget()
  const worker = new SharedWorker(import.meta.url, {
    type: 'module',
    name: 'Alinea dashboard'
  })
  worker.port.addEventListener('message', ({data}) => {
    if (data.type === IndexEvent.type) {
      events.dispatchEvent(new IndexEvent(data.data))
    } else if (data.type === ActivityEvent.type) {
      events.dispatchEvent(new ActivityEvent(data.activities))
    }
  })
  return [events, Comlink.wrap(worker.port) as any] as const
}

function isWorkerScope() {
  return (
    typeof WorkerGlobalScope !== 'undefined' &&
    globalThis instanceof WorkerGlobalScope
  )
}
