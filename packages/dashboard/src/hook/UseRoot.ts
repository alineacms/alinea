import {Root} from '@alinea/core/Root'
import {useMemo} from 'react'
import {useLocation} from 'react-router'
import {useDashboard} from './UseDashboard'

export function parseRootPath(path: string) {
  return path.split(':') as [string, string | undefined]
}

export function useRoot(): Root {
  const {config} = useDashboard()
  const location = useLocation()
  return useMemo(() => {
    let [_, workspace, root] = location.pathname.split('/')
    if (!workspace) workspace = Object.keys(config.workspaces)[0]
    if (!root) root = Object.keys(config.workspaces[workspace].roots)[0]
    return config.workspaces[workspace].roots[parseRootPath(root)[0]]
  }, [location.pathname])
}
