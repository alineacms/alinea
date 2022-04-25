import {Workspace} from '@alinea/core'
import {useMemo} from 'react'
import {useLocation} from 'react-router'
import {useDashboard} from './UseDashboard'

export function useWorkspace(): Workspace {
  const {config} = useDashboard()
  const location = useLocation()
  return useMemo(() => {
    const key = location.pathname.split('/')[1]
    if (key && config.workspaces[key]) return config.workspaces[key]
    const first = Object.keys(config.workspaces)[0]
    return config.workspaces[first]
  }, [location.pathname])
}
