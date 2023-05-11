import {Entry, Outcome, View} from 'alinea/core'
import DataLoader from 'dataloader'
import {PropsWithChildren, createContext, useContext, useMemo} from 'react'
import {useQuery} from 'react-query'
import {EntrySummaryRow} from '../view/entry/EntrySummary.js'
import {useDashboard} from './UseDashboard.js'
import {useSession} from './UseSession.js'

function useLoader() {
  const {config} = useDashboard()
  const {cnx: hub} = useSession()
  return useMemo(() => {
    return new DataLoader(
      (ids: ReadonlyArray<string>) => {
        const selection = View.getSelection(config.schema, 'summaryRow', Entry)
        const cursor = Entry.where(Entry.versionId.isIn(ids as Array<string>))
        return hub
          .query({
            cursor: cursor.select(
              Entry.type.case(selection, EntrySummaryRow.selection(Entry))
            )
          })
          .then(Outcome.unpack)
          .then(entries => {
            const res = new Map()
            for (const entry of entries) res.set(entry.id, entry)
            return ids.map(id => res.get(id))
          })
      },
      {cache: false}
    )
  }, [hub, config])
}

const context = createContext<DataLoader<string, any> | undefined>(undefined)

export function EntrySummaryProvider({children}: PropsWithChildren<{}>) {
  const loader = useLoader()
  return <context.Provider value={loader}>{children}</context.Provider>
}

export function useEntrySummary(id: string) {
  const loader = useContext(context)
  if (!loader) throw new Error('EntrySummaryProvider not found')
  return useQuery(['entry-summary', id], () => loader.load(id), {
    suspense: true
  }).data!
}
