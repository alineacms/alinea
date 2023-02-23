import {useMemo} from 'react'
import {dashboardNav} from '../DashboardNav'
import {useLocale} from './UseLocale'
import {useRoot} from './UseRoot'
import {useWorkspace} from './UseWorkspace'

export function useNav() {
  const {name: workspace} = useWorkspace()
  const {name: root} = useRoot()
  const locale = useLocale()
  return useMemo(
    () => dashboardNav({workspace, root, locale}),
    [workspace, root, locale]
  )
}
