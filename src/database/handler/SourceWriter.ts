import type {Config} from '#/core/Config.js'
import {commitChanges, type CommitRequest} from '#/core/db/CommitRequest.js'
import {EntryTransaction} from '#/core/db/EntryTransaction.js'
import type {Mutation, UpdateMutation} from '#/core/db/Mutation.js'
import {Permission, type Policy} from '#/core/Role.js'
import {SourceTransaction, type Source} from '#/core/source/Source.js'
import {createRecord} from '#/core/EntryRecord.js'
import {Field} from '#/core/Field.js'
import {Type} from '#/core/Type.js'
import {entries, fromEntries, keys} from '#/core/util/Objects.js'
import {SourceEntryDatabase} from '../entry/Source.js'
import type {EntryStore} from '../entry/Store.js'
import type {RuntimeIndexEntry} from '../runtime/Model.js'
import {SnapshotTransactionIndex} from '../entry/TransactionIndex.js'

export async function requestSourceMutations(
  config: Config,
  source: Source,
  mutations: ReadonlyArray<Mutation>,
  policy?: Policy
): Promise<CommitRequest> {
  const database = await SourceEntryDatabase.load(config, source)
  const transaction = new EntryTransaction(
    config,
    new SnapshotTransactionIndex(database.snapshot),
    source,
    database.tree,
    policy
  )
  transaction.apply([...mutations])
  return transaction.toRequest()
}

/** Builds content-only update commits without loading the complete Source DB. */
export async function requestRuntimeSourceUpdates(
  config: Config,
  source: Source,
  store: EntryStore,
  cores: ReadonlyArray<RuntimeIndexEntry>,
  mutations: ReadonlyArray<Mutation>,
  policy: Policy
): Promise<CommitRequest | undefined> {
  if (mutations.length === 0 || !mutations.every(isUpdateMutation)) return
  const updates = mutations
  const selected: Array<{
    mutation: UpdateMutation
    core: RuntimeIndexEntry
  }> = []
  for (const mutation of updates) {
    const core = cores.find(
      entry =>
        entry.entryId === mutation.id &&
        entry.locale === mutation.locale &&
        entry.versionStatus === mutation.status
    )
    if (!core?.frames?.read) return
    const type = config.schema[core.type]
    if (!type || core.type === 'MediaFile' || 'path' in mutation.set) return
    const changesSharedField = keys(mutation.set).some(key => {
      const field = Type.field(type, key)
      return field ? Boolean(Field.options(field).shared) : false
    })
    if (core.locale !== null && changesSharedField) return
    selected.push({mutation, core})
  }
  const loaded = await store.loadMany(selected.map(item => item.core))
  const tree = await source.getTree()
  const transaction = new SourceTransaction(source, tree)
  const checks: Array<[path: string, sha: string]> = []
  const messages: Array<string> = []
  for (const [position, item] of selected.entries()) {
    const entry = loaded[position]
    if (!entry) return
    const sourceEntry = tree.get(entry.filePath)
    if (
      !sourceEntry ||
      sourceEntry.type !== 'blob' ||
      sourceEntry.sha !== entry.fileHash
    )
      return
    policy.assert(Permission.Update, entry)
    for (const field of keys(item.mutation.set))
      policy.assert(Permission.Update, {
        workspace: entry.workspace,
        root: entry.root,
        type: entry.type,
        id: entry.id,
        parents: entry.parents,
        locale: entry.locale,
        field
      })
    if (entry.versionStatus === 'published')
      policy.assert(Permission.Publish, entry)
    const fieldUpdates = fromEntries(
      entries(item.mutation.set).map(([key, value]) => [key, value ?? null])
    )
    const data = {...entry.data, ...fieldUpdates}
    const record = createRecord(
      {
        id: entry.id,
        type: entry.type,
        index: entry.index,
        path: entry.path,
        seeded: entry.seeded,
        data
      },
      entry.versionStatus
    )
    transaction.add(
      entry.filePath,
      new TextEncoder().encode(JSON.stringify(record, null, 2))
    )
    checks.push([entry.filePath, entry.fileHash])
    messages.push(`(update) ${entry.title}`)
  }
  const {from, into, changes} = await transaction.compile()
  return {
    fromSha: from.sha,
    intoSha: into.sha,
    description: mutationDescription(messages),
    checks,
    changes: commitChanges(changes)
  }
}

function isUpdateMutation(mutation: Mutation): mutation is UpdateMutation {
  return mutation.op === 'update'
}

function mutationDescription(messages: ReadonlyArray<string>): string {
  return messages
    .map((message, index) => {
      if (index > 0) return message
      const suffix =
        messages.length > 1 ? ` (and ${messages.length - 1} other edits)` : ''
      return message + suffix
    })
    .join('\n')
}
