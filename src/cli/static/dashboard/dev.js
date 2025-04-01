import {EntryUpdate, IndexUpdate} from 'alinea/core/db/IndexEvent'
import {loadWorker} from 'alinea/core/worker/LoadWorker'
import {DevDashboard} from 'alinea/dashboard/dev/DevDashboard'
import * as Comlink from 'comlink'
import {createRoot} from 'react-dom/client'
import {jsx} from 'react/jsx-runtime'

const inWorker =
  typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope

if (inWorker) {
  loadWorker(loadConfig)
} else {
  const worker = new SharedWorker(import.meta.url, {type: 'module'})
  const index = new EventTarget()
  worker.port.addEventListener('message', event => {
    switch (event.data.type) {
      case IndexUpdate.type:
        console.log('Index update', event.data.sha)
        return index.dispatchEvent(new IndexUpdate(event.data.sha))
      case EntryUpdate.type:
        console.log('Entry update', event.data.id)
        return index.dispatchEvent(new EntryUpdate(event.data.id))
    }
  })
  const dbWorker = Comlink.wrap(worker.port)
  const scripts = document.getElementsByTagName('script')
  const element = scripts[scripts.length - 1]
  const into = document.createElement('div')
  into.id = 'root'
  element.parentElement.replaceChild(into, element)
  const root = createRoot(into)
  const subject = jsx(DevDashboard, {loadConfig, dbWorker, index})
  root.render(subject)
}

async function loadConfig(revision = Math.random()) {
  const exports = await import(`/config.js?${revision}`)
  if (!('cms' in exports)) throw new Error(`No config found in "/config.js"`)
  return exports
}
