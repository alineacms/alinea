import {IndexEvent} from 'alinea/core/db/IndexEvent'
import {loadWorker} from 'alinea/dashboard/Worker'
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
  worker.port.addEventListener('message', ({data}) => {
    if (data.type === IndexEvent.ENTRY || data.type === IndexEvent.INDEX)
      index.dispatchEvent(new IndexEvent(data.type, data.subject))
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
