import {Entry} from '#/core/Entry.js'
import type {EntryAnchorTarget} from '#/core/Field.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import type {Policy, Resource} from '#/core/Role.js'
import {Type} from '#/core/Type.js'
import {parents} from '#/query.js'
import {atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {configAtom, graphAtom} from './core.js'
import {entryRevisionAtom} from './graph.js'
import {policyAtom} from './user.js'
import {dispense, loader} from './utils.js'

export interface LinkEntrySummary {
  id: string
  title: string
  type: string
  workspace: string
  root: string
  preview?: string
  parents: Array<{id: string; title: string}>
  anchors: Array<EntryAnchorTarget>
}

export type LinkEntryState =
  | {state: 'loading'}
  | {state: 'hasData'; data: LinkEntrySummary | null}
  | {state: 'hasError'; error: Error}

const linkEntryLoader = atom(get => {
  const graph = get(graphAtom)
  const config = get(configAtom)
  const policy = get(policyAtom)
  return loader<LinkEntrySummary | null>(async ids => {
    const entries = await graph.find({
      id: {in: ids},
      groupBy: Entry.id,
      status: 'preferDraft',
      select: {
        id: Entry.id,
        title: Entry.title,
        type: Entry.type,
        workspace: Entry.workspace,
        root: Entry.root,
        data: Entry.data,
        preview: MediaFile.preview,
        parents: parents({select: {id: Entry.id, title: Entry.title}})
      }
    })
    const byId = new Map(entries.map(entry => [entry.id, entry] as const))
    return ids.map(id => {
      const entry = byId.get(id)
      if (
        !entry ||
        !canDiscoverLink(policy, {
          id: entry.id,
          type: entry.type,
          workspace: entry.workspace,
          root: entry.root,
          parents: entry.parents.map(parent => parent.id)
        })
      )
        return [null, null] as const
      const type = config.schema[entry.type]
      return [
        {
          ...entry,
          anchors: type ? Type.anchors(type, entry.data) : []
        },
        null
      ] as const
    })
  })
})

function canDiscoverLink(
  policy: Pick<Policy, 'canRead' | 'canExplore'>,
  resource: Resource
): boolean {
  return policy.canRead(resource) || policy.canExplore(resource)
}

export const linkEntryAtoms = dispense((id: string) => {
  const source = atom(async get => {
    get(entryRevisionAtom(id))
    const load = get(linkEntryLoader)
    const [entry, error] = await load(id)
    if (error) throw error
    return entry
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
