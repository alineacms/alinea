import {Workspace} from '@alinea/core'
import {useMemo} from 'react'
import {useMatch} from 'react-router'
import {dashboardNav} from '../DashboardNav'
import {useDashboard} from './UseDashboard'

const nav = dashboardNav({})

export function useWorkspace(): Workspace {
  const {config} = useDashboard()
  // TODO: Make this work. Preferences are undefined first
  // const [preferences] = usePreferences()
  const match = useMatch(nav.matchWorkspace)
  return useMemo(() => {
    const params: Record<string, string | undefined> = match?.params ?? {}
    const {
      workspace = Object.keys(config.workspaces)[0] // preferences.workspace ||
    } = params
    return config.workspaces[workspace]
  }, [match])
}
