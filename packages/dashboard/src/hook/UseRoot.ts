import {Root} from '@alineacms/core/Root'
import {useMemo} from 'react'
import {useLocation} from 'react-router'
import {useDashboard} from './UseDashboard'

export function useRoot(): Root & {root: string} {
  const {config} = useDashboard()
  const location = useLocation()
  return useMemo(() => {
    let [_, workspace, root] = location.pathname.split('/')
    if (!workspace) workspace = Object.keys(config.workspaces)[0]
    if (!root) root = Object.keys(config.workspaces[workspace].roots)[0]
    return {root, ...config.workspaces[workspace].roots[root]}
  }, [location.pathname])
}
