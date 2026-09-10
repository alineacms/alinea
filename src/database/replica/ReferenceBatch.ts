import {array, boolean, number, object, optional, string} from 'cito'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import type {ReplicaIdentity} from '../browser/ReplicaCache.js'

export interface ReferenceRequest {
  identity: ReplicaIdentity
  revision: string
  query: EntryReferenceQuery
}

export interface ReferenceBatch extends EntryReferenceResult {
  identity: ReplicaIdentity
  revision: string
}

const identity = object({
  project: string,
  namespace: string,
  epoch: string,
  schemaId: string,
  configId: string,
  releaseId: string,
  principal: string,
  viewId: string
})
const request = object({
  identity,
  revision: string,
  query: object({
    targetId: string,
    status: optional(string),
    locale: optional(string.nullable)
  })
})
const batch = object({
  identity,
  revision: string,
  total: number,
  scan: object({scanned: number, total: number, complete: boolean}),
  references: array(
    object({
      targetId: string,
      sourceId: string,
      sourceFilePath: string,
      sourceType: string,
      sourceLocale: string.nullable,
      sourceStatus: string,
      sourceActive: boolean,
      sourceMain: boolean,
      fieldPath: string,
      fieldLabel: optional(string),
      linkId: optional(string),
      linkType: optional(string)
    })
  )
})

export function decodeReferenceRequest(value: unknown): ReferenceRequest {
  const decoded = request(value)
  if (
    !decoded.query.targetId ||
    decoded.query.targetId.length > 128 ||
    !decoded.revision ||
    (decoded.query.status !== undefined &&
      ![
        'all',
        'published',
        'draft',
        'archived',
        'preferDraft',
        'preferPublished'
      ].includes(decoded.query.status))
  )
    throw new Error('Invalid reference query')
  return decoded as ReferenceRequest
}

export function decodeReferenceBatch(
  value: unknown,
  expected: ReferenceRequest
): ReferenceBatch {
  const decoded = batch(value)
  const status = expected.query.status ?? 'published'
  if (
    Object.keys(expected.identity).some(
      key =>
        decoded.identity[key as keyof ReplicaIdentity] !==
        expected.identity[key as keyof ReplicaIdentity]
    ) ||
    decoded.revision !== expected.revision
  )
    throw new Error('Reference response binding mismatch')
  if (
    !decoded.scan.complete ||
    !Number.isSafeInteger(decoded.total) ||
    decoded.total !== decoded.references.length ||
    !Number.isSafeInteger(decoded.scan.total) ||
    decoded.scan.total < 0 ||
    decoded.scan.scanned !== decoded.scan.total ||
    decoded.references.some(
      row =>
        row.targetId !== expected.query.targetId ||
        (expected.query.locale !== undefined &&
          row.sourceLocale !== expected.query.locale) ||
        (status === 'preferDraft'
          ? !row.sourceActive
          : status === 'preferPublished'
            ? !row.sourceMain
            : status !== 'all' && row.sourceStatus !== status) ||
        !['published', 'draft', 'archived'].includes(row.sourceStatus) ||
        (row.linkType !== undefined &&
          !['entry', 'image', 'file'].includes(row.linkType))
    )
  )
    throw new Error('Invalid reference response')
  return decoded as ReferenceBatch
}
