import {Workspace} from '@alinea/core'
import {useCurrentDraft} from '@alinea/editor/'
import {useMemo} from 'react'
import {useLocation} from 'react-router'
import {useDashboard} from './UseDashboard'

export function useWorkspace(): Workspace & {workspace: string} {
  const {config} = useDashboard()
  const draft = useCurrentDraft()
  const location = useLocation()
  return useMemo(() => {
    const [key] = location.pathname.split('/')
    if (key) return {workspace: key, ...config.workspaces[key]}
    const first = Object.keys(config.workspaces)[0]
    return {workspace: first, ...config.workspaces[first]}
  }, [location.pathname])
}
