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
   * query, eg. `{_referenced: Query.referencedBy({type: Product})}` or a
   * filter, eg. `{_referenced: {_id: id}}`
   */
  _referenced: Related<{edge: 'referencedBy'}, EntryFilterFields>
  /**
   * Whether the entry links to another entry, or to an entry that matches a
   * filter, eg. `{_references: {_id: id}}`, or a query, eg.
   * `{_references: Query.references({field: Page.author, filter: {_id: id}})}`
   * to only follow one link field. Links in lists and rich text count too.
   */
  _references: Related<{edge: 'references'}, EntryFilterFields>
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
