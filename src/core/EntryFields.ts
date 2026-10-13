import type {EntryStatus} from './Entry.js'
import {Entry} from './Entry.js'
import type {Related} from './Filter.js'

export interface EntryFields {
  _id: string
  _type: string
  _index: string
  _workspace: string
  _root: string
  _status: EntryStatus
  _parentId: string | null
  _locale: string | null
  _path: string
  _url: string
  _createdAt: number | null
  _updatedAt: number | null
  _active: boolean
}

/** The fields filters can match, next to those of the entry */
export interface EntryFilterFields extends EntryFields {
  /**
   * Whether another entry links to the entry, or an entry that matches a
   * query, eg. `{_referenced: Query.referencedBy({type: Product})}`
   */
  _referenced: Related<{edge: 'referencedBy'}>
}

export const EntryFields = {
  _id: Entry.id,
  _type: Entry.type,
  _index: Entry.index,
  _workspace: Entry.workspace,
  _root: Entry.root,
  _status: Entry.status,
  _parentId: Entry.parentId,
  _locale: Entry.locale,
  _path: Entry.path,
  _url: Entry.url,
  _createdAt: Entry.createdAt,
  _updatedAt: Entry.updatedAt,
  _active: Entry.active
}
