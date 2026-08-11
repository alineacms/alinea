import type {WithoutLabel} from '#/core/Field.js'
import type {Label} from '#/core/Label.js'
import type {Type} from '#/core/Type.js'
import type {ListRow} from '#/core/ListRow.js'
import {type FileLink, filePicker} from '#/field/link/FileLink.js'
import {
  type LinkField,
  type LinkFieldOptions,
  type LinksField,
  createLink,
  createLinks
} from '#/field/link/LinkField.js'
import {type EntryPickerConditions, entryPicker} from '#/picker/entry.js'
import type {EntryReference} from '#/picker/entry/EntryReference.js'
import {type UrlReference, urlPicker} from '#/picker/url.js'
import {EntryLink} from './EntryLink.js'
import type {UrlLink} from './UrlLink.js'

export type Link<InferredFields> =
  | EntryLink<InferredFields>
  | UrlLink<InferredFields>
  | FileLink<InferredFields>

export interface LinkOptions<Definition, Row>
  extends LinkFieldOptions<Row>, EntryPickerConditions {
  fields?: Definition | Type<Definition>
}

export type LinkRow = (EntryReference | UrlReference) & ListRow

export function link<Fields>(
  label: Label,
  options: WithoutLabel<LinkOptions<Fields, LinkRow>> = {}
): LinkField<LinkRow, Link<Type.Infer<Fields>>> {
  return createLink<LinkRow, Link<Type.Infer<Fields>>>(label, {
    ...options,
    pickers: {
      entry: entryPicker<EntryReference, Fields>({
        ...options,
        title: 'Select a page',
        max: 1,
        selection: EntryLink
      }),
      url: urlPicker<Fields>(options),
      file: filePicker(false, options)
    }
  })
}

export namespace link {
  export function multiple<Fields>(
    label: Label,
    options: WithoutLabel<LinkOptions<Fields, Array<LinkRow>>> = {}
  ): LinksField<LinkRow, Link<Type.Infer<Fields>>> {
    return createLinks<LinkRow, Link<Type.Infer<Fields>>>(label, {
      ...options,
      pickers: {
        entry: entryPicker<EntryReference, Fields>({
          ...options,
          title: 'Select a page',
          selection: EntryLink
        }),
        url: urlPicker<Fields>(options),
        file: filePicker(true, options)
      }
    })
  }
}
