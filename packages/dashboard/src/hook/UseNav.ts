import {dashboardNav} from '../DashboardNav'
import {useLocale} from './UseLocale'
import {useRoot} from './UseRoot'
import {useWorkspace} from './UseWorkspace'

export function useNav() {
  const {name: workspace} = useWorkspace()
  const {name: root} = useRoot()
  const locale = useLocale()
  return dashboardNav({workspace, root, locale})
}
