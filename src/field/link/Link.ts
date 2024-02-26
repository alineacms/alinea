import type {WithoutLabel} from 'alinea/core/Field'
import {Hint} from 'alinea/core/Hint'
import {Label} from 'alinea/core/Label'
import {Type} from 'alinea/core/Type'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {filePicker} from 'alinea/field/link/FileLink'
import {
  LinkFieldOptions,
  createLink,
  createLinks
} from 'alinea/field/link/LinkField'
import {entryFields, entryPicker} from 'alinea/picker/entry'
import {EntryReference, FileReference} from 'alinea/picker/entry/EntryReference'
import {UrlReference, urlPicker} from 'alinea/picker/url'
import {entry as entryLink} from './EntryLink.js'
import {file as fileLink} from './FileLink.js'
import {image as imageLink} from './ImageLink.js'
import {url as urlLink} from './UrlLink.js'

type LinkData<Fields> =
  | (EntryReference & Type.Infer<Fields>)
  | (UrlReference & Type.Infer<Fields>)
  | (FileReference & Type.Infer<Fields>)

export interface LinkOptions<Definition, Row> extends LinkFieldOptions<Row> {
  fields?: Definition | Type<Definition>
}

export function link<Fields>(
  label: Label,
  options: WithoutLabel<LinkOptions<Fields, LinkData<Fields>>> = {}
) {
  return createLink<LinkData<Fields>>(label, {
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
        selection: entryFields
      }),
      url: urlPicker<Fields>(options),
      file: filePicker(false, options)
    }
  })
}

export namespace link {
  type Link<Fields> =
    | (EntryReference & Type.Infer<Fields> & ListRow)
    | (UrlReference & Type.Infer<Fields> & ListRow)

  export function multiple<Fields>(
    label: Label,
    options: WithoutLabel<LinkOptions<Fields, Array<Link<Fields>>>> = {}
  ) {
    return createLinks<Link<Fields>>(label, {
      ...options,
      pickers: {
        entry: entryPicker<EntryReference, Fields>({
          ...options,
          hint: Hint.Extern({
            name: 'EntryReference',
            package: 'alinea/picker/entry'
          }),
          title: 'Select a page',
          selection: entryFields
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
