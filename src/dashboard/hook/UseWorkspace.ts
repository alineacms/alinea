import {Workspace, WorkspaceData} from 'alinea/core'
import {keys} from 'alinea/core/util/Objects'
import {usePreferences} from 'alinea/ui'
import {useMatch} from 'alinea/ui/util/HashRouter'
import {useMemo} from 'react'
import {dashboardNav} from '../DashboardNav.js'
import {useDashboard} from './UseDashboard.js'

const nav = dashboardNav({})

export function useWorkspace(): WorkspaceData & {name: string} {
  const {config} = useDashboard()
  const preferences = usePreferences()
  const match = useMatch(nav.matchWorkspace, true)
  return useMemo(() => {
    const params: Record<string, string | undefined> = match ?? {}
    const requested = [
      params.workspace,
      preferences.workspace,
      keys(config.workspaces)[0]
    ]
    for (const name of requested)
      if (name && config.workspaces[name])
        return {name, ...Workspace.data(config.workspaces[name])}
    throw new Error(`No workspace found`)
  }, [config, match])
}
