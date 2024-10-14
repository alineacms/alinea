import {EntryPhase} from './EntryRow.js'

export interface EntryFields {
  _id: string
  _type: string
  _index: string
  _i18nId: string
  _workspace: string
  _root: string
  _phase: EntryPhase
  _parent: string | null
  _locale: string | null
  _path: string
  _url: string
  _active: boolean
}
