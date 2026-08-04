import {Entry} from '#/core/Entry.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {parents} from '#/query.js'
import {atom} from 'jotai'
import {loadable} from 'jotai/utils'
import {graphAtom} from './core.js'
import {shaAtom} from './graph.js'
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
}

const linkEntryResource = dispense((id: string) =>
  atom(async get => {
    get(shaAtom)
    const graph = get(graphAtom)
    const policy = get(policyAtom)
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
        preview: MediaFile.preview,
        parents: parents({select: {id: Entry.id, title: Entry.title}})
      }
    })
    return entry &&
      policy.canRead({
        id: entry.id,
        type: entry.type,
        workspace: entry.workspace,
        root: entry.root,
        parents: entry.parents.map(parent => parent.id)
      })
      ? entry
      : null
  })
)

export const linkEntryAtoms = dispense((id: string) =>
  loadable(linkEntryResource(id))
)
