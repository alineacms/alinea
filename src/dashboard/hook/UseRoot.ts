import {Root} from 'alinea/core'
import {useMatch} from 'alinea/ui/util/HashRouter'
import {useMemo} from 'react'
import {dashboardNav} from '../DashboardNav.js'
import {useDashboard} from './UseDashboard.js'
import {useWorkspace} from './UseWorkspace.js'

const nav = dashboardNav({})

export function parseRootPath(path: string) {
  return path.split(':') as [string, string | undefined]
}

export function useRoot(): Root {
  const {config} = useDashboard()
  const workspace = useWorkspace()
  const match = useMatch(nav.matchRoot, true)
  return useMemo(() => {
    const params: Record<string, string | undefined> = match ?? {}
    const first = Object.keys(workspace.roots)[0]
    const {root = first} = params
    return workspace.roots[parseRootPath(root)[0]] || workspace.roots[first]
  }, [config, match])
}
