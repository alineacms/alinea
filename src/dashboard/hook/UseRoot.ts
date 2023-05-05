import {Root, RootData} from 'alinea/core'
import {keys} from 'alinea/core/util/Objects'
import {useMatch} from 'alinea/ui/util/HashRouter'
import {useMemo} from 'react'
import {dashboardNav} from '../DashboardNav.js'
import {useDashboard} from './UseDashboard.js'
import {useWorkspace} from './UseWorkspace.js'

const nav = dashboardNav({})

export function parseRootPath(path: string) {
  return path.split(':') as [string, string | undefined]
}

export function useRoot(): RootData & {name: string} {
  const {config} = useDashboard()
  const workspace = useWorkspace()
  const match = useMatch(nav.matchRoot, true)
  return useMemo(() => {
    const params: Record<string, string | undefined> = match ?? {}
    const requested = [params.root, keys(workspace.roots)[0]]
    for (const name of requested)
      if (name && workspace.roots[name])
        return {name, ...Root.data(workspace.roots[name])}
    throw new Error(`No root found`)
  }, [config, match])
}
