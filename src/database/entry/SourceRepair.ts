import type {Config} from '#/core/Config.js'
import {createRecord} from '#/core/EntryRecord.js'
import {createId} from '#/core/Id.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import type {ChangesBatch} from '#/core/source/Change.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import type {Source} from '#/core/source/Source.js'
import {Policy} from '#/core/Role.js'
import {assert} from '#/core/util/Assert.js'
import {dirname, join} from '#/core/util/Paths.js'
import {requestRuntimeSourceMutations} from '../handler/SourceWriter.js'
import {
  runtimeSourcePathResolver,
  type RuntimeDatabaseIndex
} from '../runtime/Model.js'
import type {EntryStore} from './Store.js'
import {entrySeeds, type EntrySeed} from './Source.js'

export async function seedSource(
  config: Config,
  source: Source,
  store: EntryStore,
  runtime: RuntimeDatabaseIndex
): Promise<ChangesBatch | undefined> {
  const entries = runtime.entries.filter(entry => entry.queryable)
  const sourcePath = runtimeSourcePathResolver(config, entries)
  const childrenDir = (entry: (typeof entries)[number]) =>
    join(dirname(sourcePath(entry)), entry.path)
  for (const seed of entrySeeds(config).values()) {
    const existing = entries.find(
      entry =>
        Boolean(entry.frames?.data) && childrenDir(entry) === seed.nodePath
    )
    if (existing) {
      assert(existing.type === seed.type, `Type mismatch in ${seed.nodePath}`)
      continue
    }
    const seeded = entries.find(
      entry =>
        entry.seeded === seed.seedPath &&
        entry.root === seed.root &&
        entry.workspace === seed.workspace
    )
    if (seeded) {
      assert(seeded.type === seed.type, `Type mismatch in ${seed.nodePath}`)
      continue
    }
    const parent = entries.find(
      entry =>
        Boolean(entry.frames?.data) &&
        childrenDir(entry) === dirname(seed.nodePath)
    )
    const mutation = seedMutation(seed, entries, parent?.entryId ?? null)
    const request = await requestRuntimeSourceMutations(
      config,
      source,
      store,
      runtime,
      [mutation],
      Policy.ALLOW_ALL
    )
    const changes = sourceChanges(request)
    if (changes.changes.length === 0) continue
    await source.applyChanges(changes)
    return changes
  }
}

export async function fixSource(
  config: Config,
  source: Source,
  store: EntryStore,
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

function seedMutation(
  seed: EntrySeed,
  entries: RuntimeDatabaseIndex['entries'],
  parentId: string | null
): Mutation {
  let id = createId()
  if (seed.locale) {
    const translated = entries.find(
      entry =>
        entry.root === seed.root &&
        entry.workspace === seed.workspace &&
        entry.parentId === parentId &&
        entry.locale !== seed.locale &&
        entry.path === seed.data.path &&
        Boolean(entry.seeded?.endsWith(seed.translationPathEnd))
    )
    if (translated) id = translated.entryId
  }
  return {
    op: 'create',
    id,
    parentId,
    locale: seed.locale,
    type: seed.type,
    workspace: seed.workspace,
    root: seed.root,
    fromSeed: seed.seedPath,
    data: {path: seed.data.path}
  }
}
