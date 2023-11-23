import {Expand} from 'alinea/core'
import {EntryRow} from './EntryRow.js'
import {Target} from './pages/Target.js'

export type Entry = Expand<EntryRow>
export const Entry = Target.create<Entry>({})
