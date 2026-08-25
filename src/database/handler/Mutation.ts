import type {Mutation} from '#/core/db/Mutation.js'
import type {Policy, Resource} from '#/core/Role.js'
import type {DatabaseSnapshot} from '../Database.js'
import {entryResource} from '../entry/Access.js'
import {
  type AlineaDatabaseRecord,
  type EntryCoreRecord,
  type EntryPayloadRecord,
  isEntryCoreRecord,
  isEntryPayloadRecord,
  isEntryReadRecord
} from '../entry/Model.js'
import {
  applyFieldOperations,
  type FieldConflict,
  type FieldOperation,
  type FieldTransaction
} from '../replica/Operations.js'

export interface PreparedFieldMutation {
  mutations: ReadonlyArray<Mutation>
  conflicts: ReadonlyArray<FieldConflict>
}

/** Validates field hashes and translates accepted paths to existing cloud writes. */
export async function prepareFieldMutation(
  snapshot: DatabaseSnapshot<AlineaDatabaseRecord>,
  transaction: FieldTransaction,
  policy: Policy
): Promise<PreparedFieldMutation> {
  const cores = new Map<string, EntryCoreRecord>()
  const payloads = new Map<string, EntryPayloadRecord>()
  const payloadByVersion = new Map<string, string>()
  for (const record of snapshot.records()) {
    if (isEntryCoreRecord(record)) cores.set(record.id, record)
    else if (isEntryPayloadRecord(record)) payloads.set(record.id, record)
    else if (isEntryReadRecord(record))
      payloadByVersion.set(record.entryVersionId, record.payloadId)
  }
  const versionByPayload = new Map(
    [...payloadByVersion].map(([version, payload]) => [payload, version])
  )
  const translated: Array<FieldOperation> = []
  const originalRecordIds = new Map<string, string>()
  for (const operation of transaction.operations) {
    const payloadId = isEntryCoreRecord(snapshot.get(operation.recordId))
      ? payloadByVersion.get(operation.recordId)
      : operation.recordId
    if (!payloadId) {
      translated.push(operation)
      continue
    }
    translated.push({...operation, recordId: payloadId})
    originalRecordIds.set(payloadId, operation.recordId)
  }
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

function firstField(pointer: string): string | undefined {
  if (!pointer.startsWith('/')) return undefined
  const [field] = pointer.slice(1).split('/')
  return field?.replaceAll('~1', '/').replaceAll('~0', '~')
}
