import {Workspace} from '@alinea/core'
import {usePreferences} from '@alinea/ui'
import {useMatch} from '@alinea/ui/util/HashRouter'
import {useMemo} from 'react'
import {dashboardNav} from '../DashboardNav'
import {useDashboard} from './UseDashboard'

const nav = dashboardNav({})

export function useWorkspace(): Workspace {
  const {config} = useDashboard()
  const preferences = usePreferences()
  const match = useMatch(nav.matchWorkspace, true)
  return useMemo(() => {
    const params: Record<string, string | undefined> = match ?? {}
    const keys = Object.keys(config.workspaces)
    const {
      workspace = keys.includes(preferences.workspace!)
        ? preferences.workspace!
        : keys[0]
    } = params
    return config.workspaces[workspace] || config.workspaces[keys[0]]
  }, [config, match])
}
