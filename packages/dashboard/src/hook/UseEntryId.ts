import {useMemo} from 'react'
import {useMatch} from 'react-router'
import {dashboardNav, EntryLocation} from '../DashboardNav'

const nav = dashboardNav({})

export function useEntryLocation(): EntryLocation | undefined {
  const match = useMatch(nav.matchEntryId)
  return useMemo(() => {
    const params = match?.params as EntryLocation
    return params || undefined
  }, [match])
}
