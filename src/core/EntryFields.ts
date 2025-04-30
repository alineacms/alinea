import {Entry} from 'alinea/core'
import type {EntryStatus} from './Entry.js'

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
  _active: boolean
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
  _active: Entry.active
}
