import type {Config} from '#/core/Config.js'
import {buildEntryDatabase} from '#/database/entry/Source.js'
import type {ReplicaRelease} from '#/database/handler/Service.js'
import type {SerializedHandlerKeyCatalog} from '#/database/replica/Serialization.js'
import {
  deserializeHandlerKeys,
  deserializeReplicaCatalog,
  type SerializedReplicaCatalog
} from '#/database/replica/Serialization.js'
import {readGeneratedJson} from './GeneratedArtifacts.js'
import {generatedSource} from './GeneratedSource.js'

const releases = new WeakMap<Config, Promise<ReplicaRelease>>()

export function generatedReplica(config: Config): Promise<ReplicaRelease> {
  let pending = releases.get(config)
  if (!pending) {
    pending = loadGeneratedReplica(config)
    releases.set(config, pending)
  }
  return pending
}

async function loadGeneratedReplica(config: Config): Promise<ReplicaRelease> {
  const [serializedCatalog, serializedKeys] = await Promise.all([
    readGeneratedJson<SerializedReplicaCatalog>('replica-catalog.json'),
    readGeneratedJson<SerializedHandlerKeyCatalog>('replica-keys.json')
  ])
  const source = await generatedSource
  const catalog = deserializeReplicaCatalog(serializedCatalog)
  const keys = deserializeHandlerKeys(serializedKeys)
  const snapshot = await buildEntryDatabase(config, source)
  return {snapshot, catalog, keys}
}
