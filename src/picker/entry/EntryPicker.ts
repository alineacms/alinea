import type {EntryFields} from '#/core/EntryFields.js'
import {Entry} from '#/core/Entry.js'
import type {LinkResolver} from '#/core/db/LinkResolver.js'
import {filterChecker, type OpenFilter} from '#/core/Filter.js'
import type {Graph, Projection} from '#/core/Graph.js'
import type {Label} from '#/core/Label.js'
import type {Picker} from '#/core/Picker.js'
import {Reference} from '#/core/Reference.js'
import {Type, type} from '#/core/Type.js'
import {ListRow} from '#/core/ListRow.js'
import {linkedMediaAlt} from '#/core/media/MediaAltField.js'
import {MediaLocation} from '#/core/media/MediaLocation.js'
import {applyUrlSuffix} from '#/core/util/Anchors.js'
import {assign, keys} from '#/core/util/Objects.js'
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
  /**
   * Filter entries by a condition, shown as a flat list across all locations.
   * Filter on entry properties such as `_type` or on the fields of the
   * entries that can be picked.
   */
  condition?: DynamicOption<OpenFilter<EntryFields>>
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
  /** @internal Picks uploaded files: any of them, or images */
  files?: 'file' | 'image'
  max?: number
  label?: string
  title?: Label
  fields?: Definition | Type<Definition>
}

export function entryPicker<Ref extends EntryReference, Fields>(
  options: EntryPickerOptions<Fields>
): Picker<Ref, EntryPickerOptions<Fields>> {
  // The dashboard checks conditions against loaded entries, which can't run a
  // relation query: report a static condition with one when the config loads
  if (options.condition && typeof options.condition !== 'function')
    assertPickerCondition(options.condition)
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
        [EntryReference.locale]: locale,
        [EntryReference.anchor]: anchor,
        [EntryReference.suffix]: suffix,
        [ListRow.index]: index,
        [ListRow.label]: label,
        ...fields
      } = row as EntryReference & ListRow
      for (const key of keys(fields)) delete row[key]
      row.fields = fields
      if (label !== undefined) row.label = label
      if (!entryId) {
        row[unresolvedEntryMarker] = true
        return
      }
      const linkIds = [entryId]
      if (!options.selection) return
      const [extra] = await loader.resolveLinks(
        options.selection,
        linkIds,
        locale
      )
      if (!extra) {
        row[unresolvedEntryMarker] = true
        return
      }
      if (type === 'file') {
        const {extension, root: _root, workspace: _workspace, ...rest} = extra
        assign(row, rest, {extension})
        return
      }
      if (type !== 'image') {
        assign(row, extra)
        applyUrlSuffixToRow(row, suffix, anchor)
        return
      }
      const {
        extension,
        src,
        alt,
        root: _root,
        workspace: _workspace,
        ...rest
      } = extra
      const selectedAlt = linkedMediaAlt(
        loader.config,
        {root: _root, workspace: _workspace},
        alt,
        loader.locale
      )
      const version = typeof rest.hash === 'string' ? rest.hash : undefined
      const versionedSrc =
        typeof src === 'string' ? MediaLocation.versionedUrl(src, version) : src
      assign(row, rest, {extension, src: versionedSrc})
      row.alt = selectedAlt
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

/** @internal Throws for conditions an entry picker can't check, eg. relation filters */
export function assertPickerCondition(
  condition: OpenFilter<EntryFields>
): void {
  try {
    filterChecker(condition)
  } catch (error) {
    throw new Error(
      `Invalid entry picker condition: ${(error as Error).message}`,
      {cause: error}
    )
  }
}
