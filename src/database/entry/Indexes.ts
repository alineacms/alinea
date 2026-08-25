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

export const entryDatabaseSchema = new DatabaseSchema<AlineaDatabaseRecord>()
  .add(allEntries)
  .add(entriesById)
  .add(entriesByParent)
  .add(entriesByType)
  .add(entriesByLocation)
  .add(entriesByUrl)

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

function entryIndex(
  name: string,
  keys: (entry: EntryCoreRecord) => ReadonlyArray<string>
): DatabaseIndex<AlineaDatabaseRecord, EntryReference> {
  return new DatabaseIndex({
    name,
    project(record) {
      if (record.kind !== 'entry') return []
      return keys(record).map(key => ({
        key,
        order: [record.index, record.locale, statusOrder(record.versionStatus)],
        metadata: entryReference(record)
      }))
    },
    metadataEqual: entryReferenceEqual
  })
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
