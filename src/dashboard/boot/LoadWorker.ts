import * as Comlink from 'comlink'
import type {ConfigGenerator} from './Boot.js'
import {ReplicaWorkerHost} from './ReplicaWorkerHost.js'

export function loadReplicaWorker(gen: ConfigGenerator): void {
  const batch = gen.next().then(batch => {
    if (batch.done) throw new Error('Missing replica worker configuration')
    return batch.value
  })
  // Install the port listener before awaiting the dynamic config import.
  Comlink.expose(new ReplicaWorkerHost(batch))
}
