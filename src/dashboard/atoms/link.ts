import type {EntryAnchorTarget} from '#/core/Field.js'
import {Permission} from '#/core/Role.js'
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
  preview?: string
  parents: Array<{id: string; title: string}>
  anchors: Array<EntryAnchorTarget>
  /** The editor can open the entry, not only link to it */
  readable: boolean
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
      preview:
        typeof entry.data.preview === 'string' ? entry.data.preview : undefined,
      parents,
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
  return unwrap(result, (): LinkEntryState => ({state: 'loading'}))
})
