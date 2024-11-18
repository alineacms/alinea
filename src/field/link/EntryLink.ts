import {Entry} from 'alinea/core'
import type {WithoutLabel} from 'alinea/core/Field'
import {InferStoredValue} from 'alinea/core/Infer'
import {Label} from 'alinea/core/Label'
import {Type} from 'alinea/core/Type'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {
  LinkFieldOptions,
  createLink,
  createLinks
} from 'alinea/field/link/LinkField'
import {EntryPickerOptions, entryPicker} from 'alinea/picker/entry'
import {EntryReference} from 'alinea/picker/entry/EntryReference'

export interface EntryLink<InferredFields = undefined> extends EntryReference {
  entryId: string
  entryType: string
  title: string
  path: string
  href: string
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
  extends LinkFieldOptions<EntryReference & InferStoredValue<Fields>>,
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
        withNavigation: Boolean(options.location || !options.condition),
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
    extends LinkFieldOptions<
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
          withNavigation: !options.condition,
          title: 'Select a page',
          selection: EntryLink
        })
      }
    })
  }
}
