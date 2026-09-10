import {array, boolean, number, object, string} from 'cito'
import type {EntryStatus} from '#/core/Entry.js'
import {Permission, Policy} from '#/core/Role.js'
import {HttpError} from '#/core/HttpError.js'
import {isRecord} from '#/core/util/Objects.js'
import {entryIndexRow, entryVersionId} from '../entry/Schema.js'
import type {IndexBootstrap} from '../replica/Bootstrap.js'
import type {ReplicaIdentity} from './ReplicaCache.js'

const IndexEntry = object({
  id: string,
  locale: string.nullable,
  versionStatus: string,
  status: string,
  type: string,
  title: string,
  workspace: string,
  root: string,
  sourceRoot: string.nullable,
  parentId: string.nullable,
  parents: array(string),
  level: number,
  index: string,
  ordinal: number,
  path: string,
  url: string,
  active: boolean,
  main: boolean,
  visible: boolean,
  seeded: string.nullable,
  rowHash: string
})

export interface ExpectedReplica extends Partial<ReplicaIdentity> {
  project: string
  namespace: string
  principal: string
}

/** Decode only structural fields; never trust disk cache rows as authentication. */
export function decodeBootstrap(
  value: unknown,
  expected: ExpectedReplica
): IndexBootstrap {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isRecord(value.identity) ||
    typeof value.revision !== 'string' ||
    !value.revision ||
    !Array.isArray(value.entries)
  )
    throw new Error('Invalid replica bootstrap')
  const identity = {} as ReplicaIdentity
  for (const key of [
    'project',
    'namespace',
    'principal',
    'viewId',
    'releaseId',
    'schemaId',
    'configId',
    'epoch'
  ] as const) {
    const input = value.identity[key]
    if (
      typeof input !== 'string' ||
      !input ||
      input.length > 4096 ||
      (expected[key] !== undefined && expected[key] !== input)
    )
      throw new HttpError(403, 'Replica bootstrap identity mismatch')
    identity[key] = input
  }
  const seen = new Set<string>()
  const entries = value.entries.map(row => {
    if (!isRecord(row)) throw new Error('Invalid bootstrap row')
    const raw = IndexEntry(row.entry)
    const status = entryStatus(raw.status)
    const versionStatus = entryStatus(raw.versionStatus)
    if (
      !raw.id ||
      !raw.type ||
      !raw.workspace ||
      !raw.root ||
      !raw.rowHash ||
      !raw.visible ||
      !Number.isSafeInteger(raw.level) ||
      raw.level < 0 ||
      !Number.isSafeInteger(raw.ordinal) ||
      raw.ordinal < 0 ||
      raw.parents.length !== raw.level
    )
      throw new Error('Invalid bootstrap entry')
    const versionId = entryVersionId(raw.id, raw.locale, versionStatus)
    if (seen.has(versionId)) throw new Error('Duplicate bootstrap entry')
    seen.add(versionId)
    const permissions = permissionBits(row.permissions)
    if (!(permissions & Permission.Explore))
      throw new Error('Bootstrap entry requires explore permission')
    const payloadId = row.payloadId
    if (
      payloadId !== undefined &&
      (typeof payloadId !== 'string' ||
        !payloadId ||
        !(permissions & Permission.Read))
    )
      throw new Error('Invalid bootstrap payload permission')
    const {versionId: _, ...entry} = entryIndexRow({
      ...raw,
      parents: [...raw.parents],
      status,
      versionStatus
    })
    return {
      entry,
      permissions,
      ...(typeof payloadId === 'string' ? {payloadId} : {})
    }
  })
  const scopePolicy = Policy.fromData(value.scopePolicy).data()
  const visibleIds = new Set(
    entries.flatMap(({entry}) => [entry.id, ...entry.parents])
  )
  if (
    scopePolicy.entries.some(
      ([key]) => key.startsWith('Entry.') && !visibleIds.has(key.slice(6))
    )
  )
    throw new Error('Hidden entry in bootstrap scope policy')
  return {
    version: 1,
    identity,
    revision: value.revision,
    permissions: permissionBits(value.permissions),
    scopePolicy,
    entries
  }
}

function permissionBits(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > Permission.All
  )
    throw new Error('Invalid bootstrap permissions')
  return value
}

function entryStatus(value: string): EntryStatus {
  if (value === 'draft' || value === 'published' || value === 'archived')
    return value
  throw new Error('Invalid bootstrap entry status')
}
