import {Page} from 'alinea/core/Page'
import DataLoader from 'dataloader'
import {atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {entryRevisionAtoms, findAtom} from './EntryAtoms.js'

export const entrySummaryLoaderAtom = atom(async get => {
  const find = await get(findAtom)
  return new DataLoader(async (ids: ReadonlyArray<string>) => {
    const res = new Map()
    const entries = await find(
      Page()
        .select({
          entryId: Page.entryId,
          type: Page.type,
          workspace: Page.workspace,
          root: Page.root,
          title: Page.title,
          parents({parents}) {
            return parents(Page).select({
              entryId: Page.entryId,
              title: Page.title
            })
          }
        })
        .where(Page.entryId.isIn(ids))
    )
    for (const entry of entries) res.set(entry.entryId, entry)
    return ids.map(id => res.get(id)) as typeof entries
  })
})

export const entrySummaryAtoms = atomFamily((id: string) => {
  return atom(async get => {
    const loader = await get(entrySummaryLoaderAtom)
    // We clear the dataloader cache because we use the atom family cache
    const summary = await loader.clear(id).load(id)
    get(entryRevisionAtoms(id))
    for (const parent of summary.parents)
      get(entryRevisionAtoms(parent.entryId))
    return summary
  })
})
