import type {EntryFields} from '#/core/EntryFields.js'
import {Entry} from '#/core/Entry.js'
import type {LinkResolver} from '#/core/db/LinkResolver.js'
import type {Filter} from '#/core/Filter.js'
import type {Graph, Projection} from '#/core/Graph.js'
import {MediaLocation} from '#/core/media/MediaLocation.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import type {Label} from '#/core/Label.js'
import type {Picker} from '#/core/Picker.js'
import {Reference} from '#/core/Reference.js'
import {Root, type RootI18n} from '#/core/Root.js'
import {Type, type} from '#/core/Type.js'
import {ListRow} from '#/core/ListRow.js'
import {applyUrlSuffix} from '#/core/util/Anchors.js'
import {assign, isRecord, keys} from '#/core/util/Objects.js'
import {LocalisedValue, selectLocalisedValue} from '#/field/localiser.js'
import {EntryReference} from './EntryReference.js'

export const unresolvedEntryMarker = Symbol('unresolvedEntryMarker')

export interface EditorInfo {
  graph: Graph
  entry: {
    id: string
    type: string
    workspace: string
    root: string
    parentId: string | null
    locale: string | null
  }
}

export interface EditorLimitLocation {
  workspace: string
  root: string
}

export interface EditorLocation extends EditorLimitLocation {
  parentId?: string
  locale?: string
}

type DynamicOption<T> = T | ((info: EditorInfo) => T | Promise<T>)

export interface EntryPickerConditions {
  /** Choose from a flat list of direct children of the currently edited entry */
  pickChildren?: boolean
  /** Set the initial location in which the entry picker is opened */
  location?: DynamicOption<EditorLocation>
  /** Filter entries by a condition, shown as a flat list across all locations */
  condition?: DynamicOption<Filter<EntryFields>>
  /** Limit the entry picker to an array of workspace and root locations */
  limitLocations?: Array<EditorLimitLocation>
  /** @internal Start the entry picker at its selected location */
  enableNavigation?: boolean
}

export interface EntryPickerOptions<
  Definition = {}
> extends EntryPickerConditions {
  selection: Projection
  defaultView?: 'row' | 'thumb'
  showMedia?: boolean
  max?: number
  label?: string
  title?: Label
  fields?: Definition | Type<Definition>
}

export function entryPicker<Ref extends EntryReference, Fields>(
  options: EntryPickerOptions<Fields>
): Picker<Ref, EntryPickerOptions<Fields>> {
  const fieldType = Type.isType(options.fields)
    ? options.fields
    : options.fields && type('Entry fields', {fields: options.fields as any})
  return {
    fields: fieldType,
    label: options.label || 'Page link',
    handlesMultiple: true,
    options,
    async postProcess(row: any, loader) {
      const {
        [Reference.id]: id,
        [Reference.type]: type,
        [EntryReference.entry]: entryId,
        [EntryReference.anchor]: anchor,
        [EntryReference.suffix]: suffix,
        [ListRow.index]: index,
        ...fields
      } = row as EntryReference & ListRow
      for (const key of keys(fields)) delete row[key]
      row.fields = fields
      if (!entryId) {
        row[unresolvedEntryMarker] = true
        return
      }
      const linkIds = [entryId]
      if (!options.selection) return
      const selection = {
        ...options.selection,
        _media: {
          entryUrl: Entry.url,
          extension: MediaFile.extension,
          location: MediaFile.location,
          path: Entry.path,
          root: Entry.root,
          workspace: Entry.workspace
        }
      }
      const [extra] = await loader.resolveLinks(selection, linkIds)
      if (!extra) {
        row[unresolvedEntryMarker] = true
        return
      }
      const {_media: media, ...selected} = extra
      if (type === 'file') {
        const {
          extension,
          href: _href,
          root: _root,
          url,
          workspace: _workspace,
          ...rest
        } = selected
        const mediaUrl = MediaLocation.publicUrl(loader.resolver.config, media)
        assign(row, rest, {extension})
        row.href = mediaUrl
        if (typeof url === 'string') row.url = mediaUrl
        return
      }
      if (type !== 'image') {
        assign(row, selected)
        applyUrlSuffixToRow(row, suffix, anchor)
        return
      }
      const {
        extension,
        src: _location,
        previewUrl,
        filePath,
        alt,
        root: _root,
        workspace: _workspace,
        ...rest
      } = selected
      const mediaUrl = MediaLocation.publicUrl(loader.resolver.config, media)
      const selectedAlt = selectImageAlt(alt, loader, {
        root: media.root,
        workspace: media.workspace
      })
      if (!previewUrl) {
        assign(row, rest, {extension, src: mediaUrl})
        if (typeof selectedAlt === 'string') row.alt = selectedAlt
        return
      }
      // If the DB was built with this entry in it we can assume the location
      // is ready to use, otherwise use the preview url
      const locationAvailable = loader.includedAtBuild(filePath)
      row.src = locationAvailable ? mediaUrl : previewUrl
      row.extension = extension
      if (typeof selectedAlt === 'string') row.alt = selectedAlt
      assign(row, rest)
    }
  }
}

function applyUrlSuffixToRow(
  row: Record<string, unknown>,
  suffix: string | undefined,
  anchor: string | undefined
) {
  if (typeof row.url === 'string')
    row.url = applyUrlSuffix(row.url, suffix, anchor)
  if (typeof row.href === 'string')
    row.href = applyUrlSuffix(row.href, suffix, anchor)
}

interface LinkedEntryLocation {
  root: unknown
  workspace: unknown
}

function selectImageAlt(
  alt: unknown,
  loader: LinkResolver,
  location: LinkedEntryLocation
): string {
  if (isRecord(alt)) {
    const localisation = linkedLocalisation(loader, location)
    return selectLocalisedValue({
      value: alt as LocalisedValue<string, string>,
      locale: loader.locale,
      locales: localisation?.locales ?? keys(alt),
      fallback: localisation?.fallback,
      defaultValue: ''
    })
  }
  if (typeof alt === 'string') return alt
  return ''
}

function linkedLocalisation(
  loader: LinkResolver,
  {workspace, root}: LinkedEntryLocation
): RootI18n | undefined {
  if (typeof workspace !== 'string' || typeof root !== 'string') return
  const workspaceConfig = loader.resolver.config.workspaces[workspace]
  const rootConfig = workspaceConfig?.[root]
  if (!rootConfig) return
  const rootData = Root.data(rootConfig)
  return Root.mediaI18n(rootData) ?? rootData.i18n
}
