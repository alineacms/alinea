import {Root} from '@alinea/core'
import {useMatch} from '@alinea/ui/util/HashRouter'
import {useMemo} from 'react'
import {dashboardNav} from '../DashboardNav'
import {useDashboard} from './UseDashboard'

const nav = dashboardNav({})

export function parseRootPath(path: string) {
  return path.split(':') as [string, string | undefined]
}

export function useRoot(): Root {
  const {config} = useDashboard()
  const match = useMatch(nav.matchRoot, true)
  return useMemo(() => {
    const params: Record<string, string | undefined> = match ?? {}
    const {
      workspace = Object.keys(config.workspaces)[0],
      root = Object.keys(config.workspaces[workspace].roots)[0]
    } = params
    return config.workspaces[workspace].roots[parseRootPath(root)[0]]
  }, [config, match])
}
