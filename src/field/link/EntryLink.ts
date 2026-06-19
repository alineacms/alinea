import {Entry} from '#/core/Entry.js'
import type {WithoutLabel} from '#/core/Field.js'
import type {InferStoredValue} from '#/core/Infer.js'
import type {Label} from '#/core/Label.js'
import type {Type} from '#/core/Type.js'
import type {ListRow} from '#/core/ListRow.js'
import {
  type LinkFieldOptions,
  createLink,
  createLinks
} from '#/field/link/LinkField.js'
import {type EntryPickerOptions, entryPicker} from '#/picker/entry.js'
import type {EntryReference} from '#/picker/entry/EntryReference.js'

export interface EntryLink<InferredFields = undefined> extends EntryReference {
  entryId: string
  entryType: string
  title: string
  path: string
  href: string
  url: string
  fields: InferredFields
}

export namespace EntryLink {
  export const entryId = Entry.id
  export const title = Entry.title
  export const entryType = Entry.type
  export const url = Entry.url
  export const href = Entry.url
  export const path = Entry.path
}

interface EntryOptions<Fields>
  extends
    LinkFieldOptions<EntryReference & InferStoredValue<Fields>>,
    Omit<EntryPickerOptions<Fields>, 'label' | 'selection'> {}

export function entry<Fields = undefined>(
  label: Label,
  options: WithoutLabel<EntryOptions<Fields>> = {}
) {
  return createLink<
    EntryReference & InferStoredValue<Fields>,
    EntryLink<Type.Infer<Fields>>
  >(label, {
    ...options,
    pickers: {
      entry: entryPicker({
        ...options,
        title: 'Select a page',
        max: 1,
        selection: EntryLink
      })
    }
  })
}

export namespace entry {
  type EntryRow<Fields> = EntryLink<Type.Infer<Fields>> & ListRow

  interface EntryOptions<Fields>
    extends
      LinkFieldOptions<
        Array<EntryReference & ListRow & InferStoredValue<Fields>>
      >,
      Omit<EntryPickerOptions<Fields>, 'label' | 'selection'> {}

  export function multiple<Fields = undefined>(
    label: Label,
    options: WithoutLabel<EntryOptions<Fields>> = {}
  ) {
    return createLinks<EntryReference & ListRow, EntryRow<Fields>>(label, {
      ...options,
      pickers: {
        entry: entryPicker<EntryReference, Fields>({
          ...options,
          title: 'Select a page',
          selection: EntryLink
        })
      }
    })
  }
}
