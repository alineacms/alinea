import {summarySelection} from 'alinea/core/media/Summary'
import DataLoader from 'dataloader'
import {atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {configAtom} from './DashboardAtoms.js'
import {entryRevisionAtoms, graphAtom} from './DbAtoms.js'

export interface EntrySummary {
  id: string
  locale: string | null
  type: string
  workspace: string
  root: string
  title: string
  parents: Array<{
    id: string
    title: string
  }>
  childrenAmount: number
}

export const entrySummaryLoaderAtom = atom(async get => {
  const graph = await get(graphAtom)
  const {schema} = get(configAtom)
  const selection = summarySelection(schema)
  return new DataLoader(
    async (
      ids: ReadonlyArray<string>
    ): Promise<Array<Record<string, EntrySummary>>> => {
      const res = new Map<string, Record<string, EntrySummary>>()
      const entries: Array<EntrySummary> = await graph.find({
        select: selection,
        id: {in: ids},
        status: 'preferDraft'
      })
      for (const entry of entries) {
        const locale = entry.locale ?? ''
        if (res.has(entry.id)) res.get(entry.id)![locale] = entry
        else res.set(entry.id, {[locale]: entry})
      }
      return ids.map(id => res.get(id)!)
    }
  )
})

interface EntryKeys {
  id: string
  locale: string | null
}

export const entrySummaryAtoms = atomFamily(
  (keys: EntryKeys) => {
    return atom(async get => {
      const loader = await get(entrySummaryLoaderAtom)
      // We clear the dataloader cache because we use the atom family cache
      const summaries = await loader.clear(keys.id).load(keys.id)
      if (!summaries) return
      const summary =
        summaries[keys.locale ?? ''] ?? summaries[Object.keys(summaries)[0]]
      get(entryRevisionAtoms(summary.id))
      if (summary?.parents)
        for (const parent of summary.parents) get(entryRevisionAtoms(parent.id))
      return summary
    })
  },
  (a, b) => a.id === b.id && a.locale === b.locale
)
