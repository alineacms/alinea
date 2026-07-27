import type {Field} from '#/core/Field.js'
import type {WritableAtom} from 'jotai'
import {atom} from 'jotai'
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

export function createTreeSelection(
  initialSelection = new Set<Key>()
): TreeSelection {
  const base = atom(initialSelection)
  return atom(
    get => get(base),
    async (_get, set, next: 'all' | Set<Key>) => {
      if (next === 'all')
        throw new Error('Selecting all items is not supported')
      set(base, next)
    }
  )
}

export class MissingEntryError extends Error {
  constructor(public id: string) {
    super(`Missing entry ${id}`)
    this.name = 'MissingEntryError'
  }
}
