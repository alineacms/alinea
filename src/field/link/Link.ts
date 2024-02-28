import type {WithoutLabel} from 'alinea/core/Field'
import {Hint} from 'alinea/core/Hint'
import {Label} from 'alinea/core/Label'
import {Reference} from 'alinea/core/Reference'
import {Type} from 'alinea/core/Type'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {FileLink, filePicker} from 'alinea/field/link/FileLink'
import {
  LinkFieldOptions,
  createLink,
  createLinks
} from 'alinea/field/link/LinkField'
import {entryPicker} from 'alinea/picker/entry'
import {EntryReference} from 'alinea/picker/entry/EntryReference'
import {urlPicker} from 'alinea/picker/url'
import {EntryLink, entry as entryLink} from './EntryLink.js'
import {file as fileLink} from './FileLink.js'
import {image as imageLink} from './ImageLink.js'
import {UrlLink, url as urlLink} from './UrlLink.js'

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
) {
  return createLink<Reference, AnyLink<Type.Infer<Fields>>>(label, {
    ...options,
    pickers: {
      entry: entryPicker<EntryReference, Fields>({
        ...options,
        hint: Hint.Extern({
          name: 'EntryReference',
          package: 'alinea/picker/entry'
        }),
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
          hint: Hint.Extern({
            name: 'EntryReference',
            package: 'alinea/picker/entry'
          }),
          title: 'Select a page',
          selection: EntryLink
        }),
        url: urlPicker<Fields>(options),
        file: filePicker(true, options)
      }
    })
  }
  /** @deprecated Use Field.image */
  export const image = imageLink
  /** @deprecated Use Field.entry */
  export const entry = entryLink
  /** @deprecated Use Field.file */
  export const file = fileLink
  /** @deprecated Use Field.url */
  export const url = urlLink
}
