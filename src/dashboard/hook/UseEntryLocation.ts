import {useMatch} from 'alinea/ui/util/HashRouter'
import {useMemo} from 'react'
import {dashboardNav, EntryLocation} from '../DashboardNav.js'

const nav = dashboardNav({})

export function useEntryLocation(): EntryLocation | undefined {
  const match = useMatch(nav.matchEntryId)
  return useMemo(() => {
    const params = match as EntryLocation
    return params || undefined
  }, [match])
}
