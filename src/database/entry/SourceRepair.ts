import type {Config} from '#/core/Config.js'
import {createRecord} from '#/core/EntryRecord.js'
import {createId} from '#/core/Id.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import type {Source} from '#/core/source/Source.js'
import {assert} from '#/core/util/Assert.js'
import {dirname} from '#/core/util/Paths.js'
import {requestSourceMutations} from '../handler/SourceWriter.js'
import {SourceEntryDatabase, entrySeeds, type EntrySeed} from './Source.js'
import {SnapshotTransactionIndex} from './TransactionIndex.js'

export async function seedSource(
  config: Config,
  source: Source,
  initial: SourceEntryDatabase
): Promise<SourceEntryDatabase> {
  let database = initial
  for (const seed of entrySeeds(config).values()) {
    const index = new SnapshotTransactionIndex(database.snapshot)
    const existing = index.findFirst(
      entry => entry.childrenDir === seed.nodePath
    )
    if (existing) {
      assert(existing.type === seed.type, `Type mismatch in ${seed.nodePath}`)
      continue
    }
    const seeded = index.findFirst(
      entry =>
        entry.seeded === seed.seedPath &&
        entry.root === seed.root &&
        entry.workspace === seed.workspace
    )
    if (seeded) {
      assert(seeded.type === seed.type, `Type mismatch in ${seed.nodePath}`)
      continue
    }
    const parent = index.findFirst(
      entry => entry.childrenDir === dirname(seed.nodePath)
    )
    const mutation = seedMutation(seed, index, parent?.id ?? null)
    const request = await requestSourceMutations(config, source, [mutation])
    const changes = sourceChanges(request)
    if (changes.changes.length === 0) continue
    await source.applyChanges(changes)
    database = await SourceEntryDatabase.load(config, source)
  }
  return database
}

export async function fixSource(
  config: Config,
  source: Source,
  initial: SourceEntryDatabase
): Promise<SourceEntryDatabase> {
  const index = new SnapshotTransactionIndex(initial.snapshot)
  const tree = await source.getTree()
  const mutations: Array<Mutation> = []
  for (const entry of index.findMany(() => true)) {
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
  if (mutations.length === 0) return initial
  const request = await requestSourceMutations(config, source, mutations)
  const changes = sourceChanges(request)
  if (changes.changes.length === 0) return initial
  await source.applyChanges(changes)
  return SourceEntryDatabase.load(config, source)
}

function seedMutation(
  seed: EntrySeed,
  index: SnapshotTransactionIndex,
  parentId: string | null
): Mutation {
  let id = createId()
  if (seed.locale) {
    const translated = index.findFirst(
      entry =>
        entry.root === seed.root &&
        entry.workspace === seed.workspace &&
        entry.parentId === parentId &&
        entry.locale !== seed.locale &&
        entry.path === seed.data.path &&
        Boolean(entry.seeded?.endsWith(seed.translationPathEnd))
    )
    if (translated) id = translated.id
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
