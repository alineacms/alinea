import type {WithoutLabel} from 'alinea/core/Field'
import {Label} from 'alinea/core/Label'
import {Type} from 'alinea/core/Type'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {FileLink, filePicker} from 'alinea/field/link/FileLink'
import {
  createLink,
  createLinks,
  LinkField,
  LinkFieldOptions
} from 'alinea/field/link/LinkField'
import {entryPicker} from 'alinea/picker/entry'
import {EntryReference} from 'alinea/picker/entry/EntryReference'
import {urlPicker, UrlReference} from 'alinea/picker/url'
import {EntryLink} from './EntryLink.js'
import {UrlLink} from './UrlLink.js'

export type Link<InferredFields> =
  | EntryLink<InferredFields>
  | UrlLink<InferredFields>
  | FileLink<InferredFields>

export interface LinkOptions<Definition, Row> extends LinkFieldOptions<Row> {
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
  ) {
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
