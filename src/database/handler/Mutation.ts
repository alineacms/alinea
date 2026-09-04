import type {Mutation} from '#/core/db/Mutation.js'
import type {Entry} from '#/core/Entry.js'
import type {Policy, Resource} from '#/core/Role.js'
import {entryResource} from '../entry/Access.js'
import type {EntryStore} from '../entry/Store.js'
import {type EntryCoreRecord, type EntryPayloadRecord} from '../entry/Model.js'
import {
  applyFieldOperations,
  type FieldConflict,
  type FieldOperation,
  type FieldTransaction
} from '../replica/Operations.js'
import type {RuntimeIndexEntry} from '../runtime/Model.js'

export interface PreparedFieldMutation {
  mutations: ReadonlyArray<Mutation>
  conflicts: ReadonlyArray<FieldConflict>
}

async function applyPreparedFieldMutation(
  coreRecords: ReadonlyArray<EntryCoreRecord>,
  payloads: ReadonlyMap<string, EntryPayloadRecord>,
  payloadByVersion: ReadonlyMap<string, string>,
  translated: ReadonlyArray<FieldOperation>,
  originalRecordIds: ReadonlyMap<string, string>,
  transaction: FieldTransaction,
  policy: Policy
): Promise<PreparedFieldMutation> {
  const cores = new Map(coreRecords.map(core => [core.id, core]))
  const versionByPayload = new Map(
    [...payloadByVersion].map(([version, payload]) => [payload, version])
  )
  const applied = await applyFieldOperations(
    {...transaction, operations: translated},
    {
      records: payloads,
      authorize(record, operation) {
        const versionId = versionByPayload.get(record.id)
        const core = versionId ? cores.get(versionId) : undefined
        if (!core) return false
        const field = firstField(operation.path)
        const resource: Resource = {...entryResource(core), field}
        return policy.canUpdate(resource)
      }
    }
  )
  const conflicting = new Set(
    applied.conflicts.map(conflict => `${conflict.recordId}\0${conflict.path}`)
  )
  const fieldsByPayload = new Map<string, Set<string>>()
  for (const operation of translated) {
    if (conflicting.has(`${operation.recordId}\0${operation.path}`)) continue
    const fields = fieldsByPayload.get(operation.recordId) ?? new Set()
    const field = firstField(operation.path)
    if (field) fields.add(field)
    fieldsByPayload.set(operation.recordId, fields)
  }
  const mutations: Array<Mutation> = []
  for (const [payloadId, fields] of fieldsByPayload) {
    const payload = applied.records.get(payloadId)
    const versionId = versionByPayload.get(payloadId)
    const core = versionId ? cores.get(versionId) : undefined
    if (!payload || !core || fields.size === 0) continue
    mutations.push({
      op: 'update',
      id: core.entryId,
      locale: core.locale,
      status: core.versionStatus,
      set: Object.fromEntries(
        [...fields].map(field => [field, payload.data[field]])
      )
    })
  }
  return {
    mutations,
    conflicts: applied.conflicts.map(conflict => ({
      ...conflict,
      recordId: originalRecordIds.get(conflict.recordId) ?? conflict.recordId
    }))
  }
}

/** Loads only the runtime entries addressed by a field transaction. */
export async function prepareRuntimeFieldMutation(
  store: EntryStore,
  cores: ReadonlyArray<RuntimeIndexEntry>,
  transaction: FieldTransaction,
  policy: Policy
): Promise<PreparedFieldMutation> {
  const coreByRecord = new Map<string, RuntimeIndexEntry>()
  for (const core of cores) {
    coreByRecord.set(core.id, core)
    const filePath = core.frames?.read?.filePath
    if (filePath) coreByRecord.set(`payload:${filePath}`, core)
  }

  const requestedCores = new Map<string, RuntimeIndexEntry>()
  for (const operation of transaction.operations) {
    const core = coreByRecord.get(operation.recordId)
    if (core) requestedCores.set(core.id, core)
  }
  const requested = [...requestedCores.values()]
  const entries = await store.loadMany(requested)
  const entryByVersion = new Map<string, Entry>()
  for (const [index, entry] of entries.entries()) {
    if (entry) entryByVersion.set(requested[index].id, entry)
  }

  const payloads = new Map<string, EntryPayloadRecord>()
  const payloadByVersion = new Map<string, string>()
  const translated: Array<FieldOperation> = []
  const originalRecordIds = new Map<string, string>()
  for (const operation of transaction.operations) {
    const core = coreByRecord.get(operation.recordId)
    const entry = core ? entryByVersion.get(core.id) : undefined
    if (!core || !entry) {
      translated.push(operation)
      continue
    }
    const payloadId = `payload:${entry.filePath}`
    payloadByVersion.set(core.id, payloadId)
    payloads.set(payloadId, {
      kind: 'payload',
      id: payloadId,
      entryVersionId: core.id,
      data: entry.data
    })
    translated.push({...operation, recordId: payloadId})
    originalRecordIds.set(payloadId, operation.recordId)
  }
  return applyPreparedFieldMutation(
    cores,
    payloads,
    payloadByVersion,
    translated,
    originalRecordIds,
    transaction,
    policy
  )
}

function firstField(pointer: string): string | undefined {
  if (!pointer.startsWith('/')) return undefined
  const [field] = pointer.slice(1).split('/')
  return field?.replaceAll('~1', '/').replaceAll('~0', '~')
}
