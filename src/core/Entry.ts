import {EntryRow} from './EntryRow.js'
import {Target} from './pages/Target.js'

export interface Entry extends EntryRow {}
export const Entry = Target.create<Entry>({})
