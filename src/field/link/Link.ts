import type {WithoutLabel} from 'alinea/core/Field'
import type {Label} from 'alinea/core/Label'
import type {Type} from 'alinea/core/Type'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {type FileLink, filePicker} from 'alinea/field/link/FileLink'
import {
  type LinkField,
  type LinkFieldOptions,
  type LinksField,
  createLink,
  createLinks
} from 'alinea/field/link/LinkField'
import {type EntryPickerConditions, entryPicker} from 'alinea/picker/entry'
import type {EntryReference} from 'alinea/picker/entry/EntryReference'
import {type UrlReference, urlPicker} from 'alinea/picker/url'
import {EntryLink} from './EntryLink.js'
import type {UrlLink} from './UrlLink.js'

export type Link<InferredFields> =
  | EntryLink<InferredFields>
  | UrlLink<InferredFields>
  | FileLink<InferredFields>

export interface LinkOptions<Definition, Row>
  extends LinkFieldOptions<Row>,
    EntryPickerConditions {
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
