import type {Client} from 'alinea/core/Client'
import type {Config} from 'alinea/core/Config'
import {EntryUpdate, IndexUpdate} from 'alinea/core/db/IndexEvent'
import * as Comlink from 'comlink'
import type {ComponentType} from 'react'
import {createRoot} from 'react-dom/client'
import {App} from '../App.js'
import type {DashboardWorker} from './DashboardWorker.js'
import {loadWorker} from './LoadWorker.js'
import {WorkerDB} from './WorkerDB.js'

export interface ConfigBatch {
  dev: boolean
  revision: string
  config: Config
  client: Client
  views: Record<string, ComponentType>
}

export type ConfigGenerator = AsyncGenerator<ConfigBatch>

export async function boot(gen: ConfigGenerator) {
  const inWorker = isWorkerScope()
  if (inWorker) {
    loadWorker(gen)
  } else {
    const {worker, events} = createWorker()
    const scripts = document.getElementsByTagName('script')
    const element = scripts[scripts.length - 1]
    const into = document.createElement('div')
    into.id = 'root'
    element.parentElement!.replaceChild(into, element)
    const root = createRoot(into)
    for await (const batch of gen) {
      if (batch.dev) {
        const link = document.querySelector(
          'link[href^="/config.css"]'
        ) as HTMLLinkElement
        const copy = link.cloneNode() as HTMLLinkElement
        copy.href = `/config.css?${batch.revision}`
        copy.onload = () => link.remove()
        link.after(copy)
      }
      const db = new WorkerDB(batch.config, worker, batch.client, events)
      root.render(<App db={db} {...batch} />)
    }
  }
}

function createWorker(): {worker: DashboardWorker; events: EventTarget} {
  const worker = new SharedWorker(import.meta.url, {type: 'module'})
  const events = new EventTarget()
  worker.port.addEventListener('message', event => {
    switch (event.data.type) {
      case IndexUpdate.type:
        console.info('Index update', event.data.sha)
        return events.dispatchEvent(new IndexUpdate(event.data.sha))
      case EntryUpdate.type:
        console.info('Entry update', event.data.id)
        return events.dispatchEvent(new EntryUpdate(event.data.id))
    }
  })
  return {worker: Comlink.wrap(worker.port) as any, events}
}

function isWorkerScope() {
  return (
    typeof WorkerGlobalScope !== 'undefined' &&
    globalThis instanceof WorkerGlobalScope
  )
}
