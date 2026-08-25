import type {AccessClassId} from '../replica/Types.js'
import type {AlineaDatabaseRecord} from './Model.js'

export function exploreAccessClass(entryVersionId: string): AccessClassId {
  return `entry-explore:${entryVersionId}`
}

export function readAccessClass(entryVersionId: string): AccessClassId {
  return `entry-read:${entryVersionId}`
}

/** Assigns every entry record and its index contributions to its data tier. */
export function entryReleaseAccessClass(
  record: AlineaDatabaseRecord
): AccessClassId {
  switch (record.kind) {
    case 'entry':
      return exploreAccessClass(record.id)
    case 'entryRead':
    case 'payload':
      return readAccessClass(record.entryVersionId)
    case 'search':
      return record.audience === 'explore'
        ? exploreAccessClass(record.entryVersionId)
        : readAccessClass(record.entryVersionId)
    case 'link':
      return readAccessClass(record.sourceVersionId)
  }
}
