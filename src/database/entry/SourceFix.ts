import type {Config} from '#/core/Config.js'
import {createRecord} from '#/core/EntryRecord.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import type {ChangesBatch} from '#/core/source/Change.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import type {Source} from '#/core/source/Source.js'
import {Policy} from '#/core/Role.js'
import {requestRuntimeSourceMutations} from '../handler/SourceWriter.js'
import type {RuntimeDatabaseIndex} from '../runtime/Model.js'
import type {RuntimeEntryStore} from '../runtime/Store.js'

/** Explicitly rewrites source entry files that differ from canonical output. */
export async function fixSource(
  config: Config,
  source: Source,
  store: RuntimeEntryStore,
  runtime: RuntimeDatabaseIndex
): Promise<ChangesBatch | undefined> {
  const entries = await store.loadMany(runtime.entries)
  const tree = await source.getTree()
  const mutations: Array<Mutation> = []
  for (const entry of entries) {
    if (!entry) continue
    const record = createRecord(entry, entry.status)
    const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
    const sha = await hashBlob(contents)
    if (sha === tree.getLeaf(entry.filePath).sha) continue
    mutations.push({
      op: 'update',
      id: entry.id,
      set: entry.data,
      locale: entry.locale,
      status: entry.status
    })
  }
  if (mutations.length === 0) return
  const request = await requestRuntimeSourceMutations(
    config,
    source,
    store,
    runtime,
    mutations,
    Policy.ALLOW_ALL
  )
  const changes = sourceChanges(request)
  if (changes.changes.length === 0) return
  await source.applyChanges(changes)
  return changes
}
