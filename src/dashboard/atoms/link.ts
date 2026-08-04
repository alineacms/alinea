import {Entry} from '#/core/Entry.js'
import type {EntryAnchorTarget} from '#/core/Field.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {Type} from '#/core/Type.js'
import type {Policy} from '#/core/Role.js'
import {parents} from '#/query.js'
import {atom} from 'jotai'
import {loadable} from 'jotai/utils'
import {configAtom, graphAtom} from './core.js'
import {shaAtom} from './graph.js'
import type {Page} from './nav.js'
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

const linkEntryResource = dispense((policy: Policy) =>
  dispense((id: string) =>
    atom(async get => {
      get(shaAtom)
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
  )
)

const linkEntryPolicyAtoms = dispense((policy: Policy) =>
  dispense((id: string) => loadable(linkEntryResource(policy)(id)))
)

export function linkEntryAtoms(page: Page, id: string) {
  return linkEntryPolicyAtoms(page.auth.policy)(id)
}
