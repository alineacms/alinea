import type {WithoutLabel} from 'alinea/core/Field'
import {Hint} from 'alinea/core/Hint'
import {Label} from 'alinea/core/Label'
import {Type} from 'alinea/core/Type'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {
  LinkFieldOptions,
  createLink,
  createLinks
} from 'alinea/field/link/LinkField'
import {EntryPickerOptions, entryFields, entryPicker} from 'alinea/picker/entry'
import {EntryReference} from 'alinea/picker/entry/EntryReference'

type Link<Fields> = EntryReference & Type.Infer<Fields>

interface EntryOptions<Fields>
  extends LinkFieldOptions<Link<Fields>>,
    Omit<EntryPickerOptions<Fields>, 'label' | 'hint' | 'selection'> {}

export function entry<Fields>(
  label: Label,
  options: WithoutLabel<EntryOptions<Fields>> = {}
) {
  return createLink<Link<Fields>>(label, {
    ...options,
    pickers: {
      entry: entryPicker<EntryReference, Fields>({
        ...options,
        withNavigation: Boolean(options.location || !options.condition),
        hint: Hint.Extern({
          name: 'EntryReference',
          package: 'alinea/picker/entry'
        }),
        title: 'Select a page',
        max: 1,
        selection: entryFields
      })
    }
  } as any)
}

export namespace entry {
  type Link<Fields> = EntryReference & Type.Infer<Fields> & ListRow

  interface EntryOptions<Fields>
    extends LinkFieldOptions<Array<Link<Fields>>>,
      Omit<EntryPickerOptions<Fields>, 'label' | 'hint' | 'selection'> {}

  export function multiple<Fields>(
    label: Label,
    options: WithoutLabel<EntryOptions<Fields>> = {}
  ) {
    return createLinks<Link<Fields>>(label, {
      ...options,
      pickers: {
        entry: entryPicker<EntryReference, Fields>({
          ...options,
          withNavigation: !options.condition,
          hint: Hint.Extern({
            name: 'EntryReference',
            package: 'alinea/picker/entry'
          }),
          title: 'Select a page',
          selection: entryFields
        })
      }
    })
  }
}
