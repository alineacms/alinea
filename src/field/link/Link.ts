import type {WithoutLabel} from '#/core/Field.js'
import type {Picker} from '#/core/Picker.js'
import {assert} from '#/core/util/Assert.js'
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

/** The kinds of links a link field offers: pages, external urls and files */
export type LinkKind = 'entry' | 'url' | 'file'

interface LinksByKind<InferredFields> {
  entry: EntryLink<InferredFields>
  url: UrlLink<InferredFields>
  file: FileLink<InferredFields>
}

export type Link<
  InferredFields = {},
  Kind extends LinkKind = LinkKind
> = LinksByKind<InferredFields>[Kind]

export interface LinkOptions<Definition, Row, Kind extends LinkKind = LinkKind>
  extends LinkFieldOptions<Row>, EntryPickerConditions {
  fields?: Definition | Type<Definition>
  /**
   * The kinds of links editors can pick, eg. `['entry', 'url']` for pages and
   * external urls but no files. All of them by default.
   */
  kinds?: ReadonlyArray<Kind>
}

export type LinkRow = (EntryReference | UrlReference) & ListRow

function linkPickers<Fields>(
  kinds: ReadonlyArray<LinkKind> | undefined,
  multiple: boolean,
  options: WithoutLabel<LinkOptions<Fields, unknown>>
): Record<string, Picker<any, any>> {
  if (kinds) assert(kinds.length > 0, 'Link field kinds cannot be empty')
  const allows = (kind: LinkKind) => !kinds || kinds.includes(kind)
  const pickers: Record<string, Picker<any, any>> = {}
  if (allows('entry'))
    pickers.entry = entryPicker<EntryReference, Fields>({
      ...options,
      title: 'Select a page',
      ...(multiple ? undefined : {max: 1}),
      selection: EntryLink
    })
  if (allows('url')) pickers.url = urlPicker<Fields>(options)
  if (allows('file'))
    pickers.file = filePicker(multiple, {fields: options.fields})
  return pickers
}

export function link<Fields, const Kind extends LinkKind = LinkKind>(
  label: Label,
  options: WithoutLabel<LinkOptions<Fields, LinkRow, Kind>> = {}
): LinkField<LinkRow, Link<Type.Infer<Fields>, Kind>> {
  const {kinds, ...rest} = options
  return createLink<LinkRow, Link<Type.Infer<Fields>, Kind>>(label, {
    ...rest,
    pickers: linkPickers(kinds, false, rest)
  })
}

export namespace link {
  export function multiple<Fields, const Kind extends LinkKind = LinkKind>(
    label: Label,
    options: WithoutLabel<LinkOptions<Fields, Array<LinkRow>, Kind>> = {}
  ): LinksField<LinkRow, Link<Type.Infer<Fields>, Kind>> {
    const {kinds, ...rest} = options
    return createLinks<LinkRow, Link<Type.Infer<Fields>, Kind>>(label, {
      allowDuplicates: true,
      ...rest,
      pickers: linkPickers(kinds, true, rest)
    })
  }
}
