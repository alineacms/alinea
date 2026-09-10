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
    return fetch(url, {...init, headers: {...init.headers, authorization: 'Bearer fixture'}})
  }
}))
