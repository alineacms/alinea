import type {EntryStatus} from '#/core/Entry.js'
import {DatabaseSchema} from '../Database.js'
import {DatabaseIndex} from '../SecondaryIndex.js'
import type {AlineaDatabaseRecord, EntryCoreRecord} from './Model.js'

export interface EntryReference {
  entryId: string
  versionStatus: EntryStatus
  status: EntryStatus
  active: boolean
  main: boolean
  type: string
  workspace: string
  root: string
  locale: string | null
  parentId: string | null
  level: number
  index: string
}

export interface EntryLinkReference {
  targetId: string
  sourceEntryId: string
  sourceVersionId: string
  sourceFilePath: string
  sourceType: string
  sourceLocale: string | null
  sourceStatus: EntryStatus
  sourceActive: boolean
  sourceMain: boolean
  fieldPath: string
  fieldLabel?: string
  linkId?: string
  linkType?: 'entry' | 'image' | 'file'
}

export interface EntrySearchReference {
  entryVersionId: string
  title: string
}

export interface EntryReadReference {
  recordId: string
}

export const allEntries = entryIndex('entry.all', () => ['all'])

export const entriesById = entryIndex('entry.id', entry => [entry.entryId])

export const entriesByParent = entryIndex('entry.parent', entry => [
  parentKey(entry.workspace, entry.root, entry.parentId)
])

export const entriesByType = entryIndex('entry.type', entry => [entry.type])

export const entriesByLocation = entryIndex('entry.location', entry => [
  workspaceKey(entry.workspace),
  rootKey(entry.workspace, entry.root)
])

export const entriesByUrl = entryIndex('entry.url', entry => [entry.url])

export const entryReadsByVersion = new DatabaseIndex<
  AlineaDatabaseRecord,
  EntryReadReference
>({
  name: 'entry.read',
  project(record) {
    if (record.kind !== 'entryRead') return []
    return [
      {
        key: record.entryVersionId,
        metadata: {recordId: record.id}
      }
    ]
  },
  metadataEqual(left, right) {
    return left.recordId === right.recordId
  }
})

export const referencesByTarget = new DatabaseIndex<
  AlineaDatabaseRecord,
  EntryLinkReference
>({
  name: 'reference.target',
  project(record) {
    if (record.kind !== 'link') return []
    return [
      {
        key: record.targetId,
        order: [record.sourceEntryId, record.fieldPath, record.id],
        metadata: linkReference(record)
      }
    ]
  },
  metadataEqual: linkReferenceEqual
})

export const referencesBySource = new DatabaseIndex<
  AlineaDatabaseRecord,
  EntryLinkReference
>({
  name: 'reference.source',
  project(record) {
    if (record.kind !== 'link') return []
    return [
      {
        key: record.sourceEntryId,
        order: [record.targetId, record.fieldPath, record.id],
        metadata: linkReference(record)
      }
    ]
  },
  metadataEqual: linkReferenceEqual
})

export const searchesByAudience = new DatabaseIndex<
  AlineaDatabaseRecord,
  EntrySearchReference
>({
  name: 'search.audience',
  project(record) {
    if (record.kind !== 'search') return []
    return [
      {
        key: record.audience,
        order: [record.title, record.entryVersionId],
        metadata: {
          entryVersionId: record.entryVersionId,
          title: record.title
        }
      }
    ]
  },
  metadataEqual(left, right) {
    return (
      left.entryVersionId === right.entryVersionId && left.title === right.title
    )
  }
})

export const searchesByVersion = new DatabaseIndex<
  AlineaDatabaseRecord,
  EntryReadReference
>({
  name: 'search.version',
  project(record) {
    if (record.kind !== 'search') return []
    return [
      {
        key: searchVersionKey(record.entryVersionId, record.audience),
        metadata: {recordId: record.id}
      }
    ]
  },
  metadataEqual(left, right) {
    return left.recordId === right.recordId
  }
})

export const entryDatabaseSchema = new DatabaseSchema<AlineaDatabaseRecord>()
  .add(allEntries)
  .add(entriesById)
  .add(entriesByParent)
  .add(entriesByType)
  .add(entriesByLocation)
  .add(entriesByUrl)
  .add(entryReadsByVersion)
  .add(referencesByTarget)
  .add(referencesBySource)
  .add(searchesByAudience)
  .add(searchesByVersion)

export function workspaceKey(workspace: string): string {
  return `workspace\0${workspace}`
}

export function rootKey(workspace: string, root: string): string {
  return `root\0${workspace}\0${root}`
}

export function parentKey(
  workspace: string,
  root: string,
  parentId: string | null
): string {
  return parentId === null
    ? `root\0${workspace}\0${root}`
    : `parent\0${parentId}`
}

export function searchVersionKey(
  entryVersionId: string,
  audience: 'explore' | 'read'
): string {
  return `${audience}\0${entryVersionId}`
}

function entryIndex(
  name: string,
  keys: (entry: EntryCoreRecord) => ReadonlyArray<string>
): DatabaseIndex<AlineaDatabaseRecord, EntryReference> {
  return new DatabaseIndex({
    name,
    project(record) {
      if (record.kind !== 'entry' || !record.queryable) return []
      return keys(record).map(key => ({
        key,
        order: [record.index, record.locale, statusOrder(record.versionStatus)],
        metadata: entryReference(record)
      }))
    },
    metadataEqual: entryReferenceEqual
  })
}

function linkReference(
  record: Extract<AlineaDatabaseRecord, {kind: 'link'}>
): EntryLinkReference {
  return {
    targetId: record.targetId,
    sourceEntryId: record.sourceEntryId,
    sourceVersionId: record.sourceVersionId,
    sourceFilePath: record.sourceFilePath,
    sourceType: record.sourceType,
    sourceLocale: record.sourceLocale,
    sourceStatus: record.sourceStatus,
    sourceActive: record.sourceActive,
    sourceMain: record.sourceMain,
    fieldPath: record.fieldPath,
    fieldLabel: record.fieldLabel,
    linkId: record.linkId,
    linkType: record.linkType
  }
}

function linkReferenceEqual(
  left: EntryLinkReference,
  right: EntryLinkReference
): boolean {
  return (
    left.targetId === right.targetId &&
    left.sourceEntryId === right.sourceEntryId &&
    left.sourceVersionId === right.sourceVersionId &&
    left.sourceFilePath === right.sourceFilePath &&
    left.sourceType === right.sourceType &&
    left.sourceLocale === right.sourceLocale &&
    left.sourceStatus === right.sourceStatus &&
    left.sourceActive === right.sourceActive &&
    left.sourceMain === right.sourceMain &&
    left.fieldPath === right.fieldPath &&
    left.fieldLabel === right.fieldLabel &&
    left.linkId === right.linkId &&
    left.linkType === right.linkType
  )
}

function entryReference(entry: EntryCoreRecord): EntryReference {
  return {
    entryId: entry.entryId,
    versionStatus: entry.versionStatus,
    status: entry.status,
    active: entry.active,
    main: entry.main,
    type: entry.type,
    workspace: entry.workspace,
    root: entry.root,
    locale: entry.locale,
    parentId: entry.parentId,
    level: entry.level,
    index: entry.index
  }
}

function entryReferenceEqual(
  left: EntryReference,
  right: EntryReference
): boolean {
  return (
    left.entryId === right.entryId &&
    left.versionStatus === right.versionStatus &&
    left.status === right.status &&
    left.active === right.active &&
    left.main === right.main &&
    left.type === right.type &&
    left.workspace === right.workspace &&
    left.root === right.root &&
    left.locale === right.locale &&
    left.parentId === right.parentId &&
    left.level === right.level &&
    left.index === right.index
  )
}

function statusOrder(status: EntryStatus): number {
  switch (status) {
    case 'draft':
      return 0
    case 'published':
      return 1
    case 'archived':
      return 2
  }
}
