import type {Config} from '#/core/Config.js'
import {buildEntryDatabase} from '#/database/entry/Source.js'
import type {ReplicaRelease} from '#/database/handler/Service.js'
import type {SerializedHandlerKeyCatalog} from '#/database/replica/Serialization.js'
import {
  deserializeHandlerKeys,
  deserializeReplicaCatalog,
  type SerializedReplicaCatalog
} from '#/database/replica/Serialization.js'
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
  // @ts-ignore Generated during the Alinea build.
  const catalogModule = await import('@alinea/generated/replica-catalog.json')
  // @ts-ignore Generated during the Alinea build.
  const keysModule = await import('@alinea/generated/replica-keys.json')
  const source = await generatedSource
  const catalog = deserializeReplicaCatalog(
    moduleValue(catalogModule) as SerializedReplicaCatalog
  )
  const keys = deserializeHandlerKeys(
    moduleValue(keysModule) as SerializedHandlerKeyCatalog
  )
  const snapshot = await buildEntryDatabase(config, source)
  return {snapshot, catalog, keys}
}

function moduleValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'default' in value && value.default)
    return value.default
  return value
}
