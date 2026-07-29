import type {Field} from '#/core/Field.js'
import type {WritableAtom} from 'jotai'
import type {Key} from 'react-aria-components'

export const entryOverviewColumnCount = 5

export type EntryView = 'edit' | 'overview'
export type EntrySidebarTab = 'history' | 'preview' | 'references'

export interface EntryOverviewCell {
  id: string
  field: Field
  label: string
  value: unknown
}

export type TreeSelection = WritableAtom<
  Set<Key>,
  [next: 'all' | Set<Key>],
  Promise<void>
>

export class MissingEntryError extends Error {
  constructor(public id: string) {
    super(`Missing entry ${id}`)
    this.name = 'MissingEntryError'
  }
}
