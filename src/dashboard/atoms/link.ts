import {Entry} from '#/core/Entry.js'
import type {EntryAnchorTarget} from '#/core/Field.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {Type} from '#/core/Type.js'
import {parents} from '#/query.js'
import {atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {configAtom, graphAtom} from './core.js'
import {entryRevisionAtom} from './graph.js'
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
}

export const linkEntryAtoms = dispense((id: string) => {
  const source = atom(async get => {
    get(entryRevisionAtom(id))
    const graph = get(graphAtom)
    const config = get(configAtom)
    const [entry] = await graph.find({
      id,
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
    const policy = get(policyAtom)
    if (
      !entry ||
      !policy.canRead({
        id: entry.id,
        type: entry.type,
        workspace: entry.workspace,
        root: entry.root,
        parents: entry.parents.map(parent => parent.id)
      })
    )
      return null
    const type = config.schema[entry.type]
    return {
      ...entry,
      anchors: type ? Type.anchors(type, entry.data) : []
    }
  })
  const value = unwrap(source, previous => previous)
  const ready = atom(async get => {
    get(value)
    return get(source)
  })
  return {ready, value}
})
