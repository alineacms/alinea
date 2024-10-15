import type {WithoutLabel} from 'alinea/core/Field'
import {Label} from 'alinea/core/Label'
import {Reference} from 'alinea/core/Reference'
import {Type} from 'alinea/core/Type'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {FileLink, filePicker} from 'alinea/field/link/FileLink'
import {
  LinkField,
  LinkFieldOptions,
  createLink,
  createLinks
} from 'alinea/field/link/LinkField'
import {entryPicker} from 'alinea/picker/entry'
import {EntryReference} from 'alinea/picker/entry/EntryReference'
import {urlPicker} from 'alinea/picker/url'
import {EntryLink} from './EntryLink.js'
import {UrlLink} from './UrlLink.js'

export type AnyLink<InferredFields> =
  | EntryLink<InferredFields>
  | UrlLink<InferredFields>
  | FileLink<InferredFields>

export interface LinkOptions<Definition, Row> extends LinkFieldOptions<Row> {
  fields?: Definition | Type<Definition>
}

export function link<Fields>(
  label: Label,
  options: WithoutLabel<LinkOptions<Fields, Reference>> = {}
): LinkField<Reference, AnyLink<Type.Infer<Fields>>> {
  return createLink<Reference, AnyLink<Type.Infer<Fields>>>(label, {
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
    options: WithoutLabel<LinkOptions<Fields, Array<ListRow>>> = {}
  ) {
    return createLinks<ListRow, AnyLink<Type.Infer<Fields>>>(label, {
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
