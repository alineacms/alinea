import type {Client} from 'alinea/core/Client'
import type {Config} from 'alinea/core/Config'
import {IndexEvent, type IndexOp} from 'alinea/core/db/IndexEvent'
import {IndexedDBSource} from 'alinea/core/source/IndexedDBSource'
import * as Comlink from 'comlink'
import type {ComponentType} from 'react'
import {createRoot} from 'react-dom/client'
import {App} from '../App.js'
import {DashboardWorker} from './DashboardWorker.js'
import {loadWorker} from './LoadWorker.js'
import {WorkerDB} from './WorkerDB.js'

export interface ConfigBatch {
  local: boolean
  revision: string
  config: Config
  client: Client
  views: Record<string, ComponentType>
  alineaDev?: boolean
}

export type ConfigGenerator = AsyncGenerator<ConfigBatch>

export async function boot(gen: ConfigGenerator) {
  const inWorker = isWorkerScope()
  if (inWorker) {
    loadWorker(gen)
  } else {
    let events: EventTarget
    let worker: DashboardWorker
    try {
      worker = createSharedWorker()
      events = await connectEvents(worker, true)
    } catch (error) {
      console.warn('Shared worker not supported, falling back to local worker.')
      const source = new IndexedDBSource(globalThis.indexedDB, 'alinea')
      worker = new DashboardWorker(source)
      events = await connectEvents(worker, false)
    }
    const scripts = document.getElementsByTagName('script')
    const element = scripts[scripts.length - 1]
    const into = document.createElement('div')
    into.id = 'root'
    element.parentElement!.replaceChild(into, element)
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
      const isLocal = worker instanceof DashboardWorker
      if (isLocal) await worker.load(batch.revision, batch.config, batch.client)
      if (batch.revision !== lastRevision) {
        const db = new WorkerDB(batch.config, worker, batch.client, events)
        root.render(<App db={db} {...batch} />)
      }
      lastRevision = batch.revision
    }
  }
}

function createSharedWorker(): DashboardWorker {
  const worker = new SharedWorker(import.meta.url, {
    type: 'module',
    name: 'Alinea dashboard'
  })
  return Comlink.wrap(worker.port) as any
}

async function connectEvents(worker: DashboardWorker, remote: boolean) {
  const events = new EventTarget()
  const listen = (data: IndexOp) => {
    events.dispatchEvent(new IndexEvent(data))
  }
  await worker.subscribeIndex(remote ? Comlink.proxy(listen) : listen)
  return events
}

function isWorkerScope() {
  return (
    typeof WorkerGlobalScope !== 'undefined' &&
    globalThis instanceof WorkerGlobalScope
  )
}
