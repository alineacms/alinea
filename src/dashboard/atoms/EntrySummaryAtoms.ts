import {Page} from 'alinea/core/pages/Page'
import DataLoader from 'dataloader'
import {atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {dbAtom} from './EntryAtoms.js'

export const entrySummaryLoaderAtom = atom(get => {
  return new DataLoader(async (ids: ReadonlyArray<string>) => {
    const db = await get(dbAtom)
    const res = new Map()
    const entries = await db.find(
      Page()
        .select({
          entryId: Page.entryId,
          type: Page.type,
          workspace: Page.workspace,
          root: Page.root,
          title: Page.title,
          parents({parents}) {
            return parents(Page).select({title: Page.title})
          }
        })
        .where(Page.entryId.isIn(ids))
    )
    console.log(entries)
    for (const entry of entries) res.set(entry.entryId, entry)
    return ids.map(id => res.get(id))
  })
})

export const entrySummaryAtoms = atomFamily((id: string) => {
  return atom(get => {
    const loader = get(entrySummaryLoaderAtom)
    return loader.load(id)
  })
})
