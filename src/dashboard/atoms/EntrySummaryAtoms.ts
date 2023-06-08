import {Page} from 'alinea/core/Page'
import DataLoader from 'dataloader'
import {atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {entrySummaryQuery} from '../view/entry/EntrySummary.js'
import {entryRevisionAtoms, graphAtom} from './EntryAtoms.js'

export const entrySummaryLoaderAtom = atom(async get => {
  const {active: drafts} = await get(graphAtom)
  return new DataLoader(async (ids: ReadonlyArray<string>) => {
    const res = new Map()
    const entries = await drafts.find(
      Page().select(entrySummaryQuery()).where(Page.entryId.isIn(ids))
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
