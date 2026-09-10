import type {Client} from '#/core/Client.js'
import type {Config} from '#/core/Config.js'
import type {ComponentType} from 'react'
import {flushSync} from 'react-dom'
import {createRoot} from 'react-dom/client'
import {App} from '../App.js'
import {loadReplicaWorker} from './LoadWorker.js'
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
    loadReplicaWorker(gen)
  } else {
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
        const link = Array.from(
          document.querySelectorAll<HTMLLinkElement>(
            'link[href="config.css"], link[href^="config.css?"]'
          )
        ).at(-1)
        if (link) {
          const copy = link.cloneNode() as HTMLLinkElement
          copy.href = `config.css?${batch.revision}`
          copy.onload = () => link.remove()
          link.after(copy)
        }
      }
      if (batch.revision !== lastRevision) {
        const previous = replica
        const next = new ReplicaGraph({
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
        replica = next
        // Detach the old atom store before retiring its graph. Closing while
        // it is still mounted sends teardown errors into the active app.
        flushSync(() =>
          root.render(
            <App
              key={batch.revision}
              graph={next}
              events={next.events}
              {...batch}
            />
          )
        )
        await previous?.close()
      } else await replica?.sync().catch(() => {})
      lastRevision = batch.revision
    }
  }
}

function isWorkerScope() {
  return (
    typeof WorkerGlobalScope !== 'undefined' &&
    globalThis instanceof WorkerGlobalScope
  )
}
