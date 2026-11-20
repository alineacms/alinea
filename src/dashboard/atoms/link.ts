import type {EntryAnchorTarget} from '#/core/Field.js'
import type {Entry} from '#/core/Entry.js'
import {isFileType} from '#/core/media/MediaTypes.js'
import {Permission} from '#/core/Role.js'
import {Root} from '#/core/Root.js'
import {isRecord, values} from '#/core/util/Objects.js'
import {Type} from '#/core/Type.js'
import {atom, type Getter} from 'jotai'
import {unwrap} from 'jotai/utils'
import {configAtom} from './core.js'
import {entryAtoms, type EntryAtoms, MissingEntryError} from './entry.js'
import {policyAtom} from './user.js'
import {dispense} from './utils.js'

export interface LinkEntrySummary {
  id: string
  title: string
  type: string
  workspace: string
  root: string
  url: string
  preview?: string
  parents: Array<{id: string; title: string}>
  /** The label of the root the entry is in */
  rootLabel?: string
  /** Set for media library files */
  file?: LinkFileSummary
  anchors: Array<EntryAnchorTarget>
  /** The editor can open the entry, not only link to it */
  readable: boolean
}

export interface LinkFileSummary {
  name?: string
  extension?: string
  size?: number
  width?: number
  height?: number
  alt?: string
  averageColor?: string
  thumbHash?: string
}

export type LinkEntryState =
  | {state: 'loading'}
  | {state: 'hasData'; data: LinkEntrySummary | null}
  | {state: 'hasError'; error: Error}

async function linkEntryParent(
  get: Getter,
  id: string,
  locale: string | null
): Promise<{id: string; title: string} | undefined> {
  try {
    const parent = await get(entryAtoms(id, Permission.Explore))
    const preferred = get(parent.locales(locale).preferredEntry)
    return {id: preferred.id, title: preferred.title}
  } catch (error) {
    if (error instanceof MissingEntryError) return undefined
    throw error
  }
}

function text(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function count(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

function fileSummary(entry: Entry, locale?: string): LinkFileSummary {
  const {data} = entry
  const extension = text(data.extension)
  return {
    name: extension && `${entry.path}${extension}`,
    extension,
    size: count(data.size),
    width: count(data.width),
    height: count(data.height),
    alt: fileAlt(data.alt, locale),
    averageColor: text(data.averageColor),
    thumbHash: text(data.thumbHash)
  }
}

// Alt text can be localised while the media library itself is not
function fileAlt(alt: unknown, locale?: string) {
  if (typeof alt === 'string') return alt || undefined
  if (!isRecord(alt)) return undefined
  const localised = locale ? alt[locale] : undefined
  return text(localised) || values(alt).map(text).find(Boolean)
}

export const linkEntryAtoms = dispense((id: string, locale?: string) => {
  const source = atom(async get => {
    let model: EntryAtoms
    try {
      // Links show the entries they can be picked from
      model = await get(entryAtoms(id, Permission.Explore))
    } catch (error) {
      if (error instanceof MissingEntryError) return null
      throw error
    }
    const entry = get(model.locales(locale ?? null).preferredEntry)
    const config = get(configAtom)
    const type = config.schema[entry.type]
    const root = config.workspaces[entry.workspace]?.[entry.root]
    const parents = (
      await Promise.all(
        entry.parents.map(parentId =>
          linkEntryParent(get, parentId, entry.locale)
        )
      )
    ).filter(parent => parent !== undefined)
    return {
      id: entry.id,
      title: entry.title,
      type: entry.type,
      workspace: entry.workspace,
      root: entry.root,
      url: entry.url,
      preview: text(entry.data.preview),
      parents,
      rootLabel: root ? Root.label(root) : undefined,
      file: isFileType(type) ? fileSummary(entry, locale) : undefined,
      anchors: type ? Type.anchors(type, entry.data) : [],
      readable: get(policyAtom).canRead(entry)
    }
  })
  const result = atom(async (get): Promise<LinkEntryState> => {
    try {
      return {state: 'hasData', data: await get(source)}
    } catch (error) {
      return {
        state: 'hasError',
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  })
  // Keeps showing the loaded entry while it reloads, eg. after a publish
  return unwrap(
    result,
    (previous?: LinkEntryState): LinkEntryState =>
      previous ?? {state: 'loading'}
  )
})
