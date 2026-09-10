import {expose} from 'comlink'
import {Client} from '#/core/Client.js'
import {ReplicaWorkerHost} from '#/dashboard/boot/ReplicaWorkerHost.js'
import {config, replicaIdentity} from './config.js'

const handlerUrl = new URL('/replica', import.meta.url).href
const {project, namespace, epoch} = replicaIdentity
const ready = new Promise<void>(resolve => setTimeout(resolve, 100))
expose(new ReplicaWorkerHost(ready.then(() => ({
  config,
  local: true,
  revision: 'fixture',
  handlerUrl,
  replica: {project, namespace, epoch},
  client: new Client({config, url: handlerUrl}),
  views: {}
})), {
  indexedDB,
  fetch(url, init) {
    if (new URL(import.meta.url).searchParams.has('crash') &&
      new URL(String(url)).searchParams.get('action') === 'replicaPayloads') {
      setTimeout(() => { throw new Error('Replica fixture crash') }, 0)
      return new Promise<Response>(() => {})
    }
    return fetch(url, {...init, headers: {...init.headers, authorization: 'Bearer fixture'}})
  }
}))
