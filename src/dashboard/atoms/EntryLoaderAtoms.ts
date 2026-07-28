import type {Config} from '#/core/Config.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {Entry} from '#/core/Entry.js'
import type {Policy} from '#/core/Role.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {parents, translations} from '#/query.js'
import {atom, type Atom} from 'jotai'
import {configAtom, graphAtom} from './CoreAtoms.js'
import {MissingEntryError} from './Contracts.js'
import {policyAtom} from './PolicyAtoms.js'
import {batchLoader} from './shared/BatchLoader.js'

export interface EntryLoaderAtomsOptions {
  config: Atom<Config>
  graph: Atom<WriteableGraph>
  policy: Atom<Policy>
}

export function createVersionLoaderAtom(graph: Atom<WriteableGraph>) {
  return atom(get => {
    const db = get(graph)
    return batchLoader(async ids => {
      const rows = await db.find({
        id: {in: ids},
        status: 'all',
        select: Entry
      })
      const byId = new Map<string, Array<(typeof rows)[number]>>()
      for (const row of rows) {
        const versions = byId.get(row.id)
        if (versions) versions.push(row)
        else byId.set(row.id, [row])
      }
      return ids.map(id => [byId.get(id) ?? [], null] as const)
    })
  })
}

export function createEntryLoaderAtom(options: EntryLoaderAtomsOptions) {
  return atom(get => {
    const config = get(options.config)
    const db = get(options.graph)
    const policy = get(options.policy)
    const visibleTypes = entries(config.schema)
      .filter(([, type]) => !Type.isHidden(type))
      .map(([name]) => name)
    return batchLoader(async ids => {
      const rows = await db.find({
        groupBy: Entry.id,
        select: {
          id: Entry.id,
          type: Entry.type,
          parentId: Entry.parentId,
          workspace: Entry.workspace,
          root: Entry.root,
          parents: parents({
            select: {
              id: Entry.id,
              path: Entry.path,
              type: Entry.type,
              status: Entry.status,
              main: Entry.main
            }
          }),
          entries: translations({select: Entry, includeSelf: true})
        },
        id: {in: ids},
        status: 'preferDraft'
      })
      const parentIds = await db.find({
        select: Entry.parentId,
        parentId: {in: ids},
        filter: {_type: {in: visibleTypes}},
        groupBy: Entry.parentId,
        status: 'preferDraft'
      })
      const parentIdSet = new Set(parentIds)
      const byId = new Map(rows.map(row => [row.id, row] as const))
      return ids.map(id => {
        const row = byId.get(id)
        if (!row) return [null, new MissingEntryError(id)] as const
        const readableEntries = row.entries.filter(entry =>
          policy.canRead(entry)
        )
        if (readableEntries.length === 0)
          return [null, new MissingEntryError(id)] as const
        return [
          {
            ...row,
            entries: readableEntries,
            hasChildren: parentIdSet.has(id)
          },
          null
        ] as const
      })
    })
  })
}

export const versionLoaderAtom = createVersionLoaderAtom(graphAtom)

export const entryLoaderAtom = createEntryLoaderAtom({
  config: configAtom,
  graph: graphAtom,
  policy: policyAtom
})
