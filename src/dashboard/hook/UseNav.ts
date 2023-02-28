import {useMemo} from 'react'
import {dashboardNav} from '../DashboardNav.js'
import {useLocale} from './UseLocale.js'
import {useRoot} from './UseRoot.js'
import {useWorkspace} from './UseWorkspace.js'

export function useNav() {
  const {name: workspace} = useWorkspace()
  const {name: root} = useRoot()
  const locale = useLocale()
  return useMemo(
    () => dashboardNav({workspace, root, locale}),
    [workspace, root, locale]
  )
}
