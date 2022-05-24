import {createRoot} from 'react-dom/client'
import {DevDashboard, DevDashboardOptions} from './DevDashboard'

export function renderDashboard(
  options: DevDashboardOptions,
  into: Element | DocumentFragment
) {
  const root = createRoot(into)
  root.render(<DevDashboard {...options} />)
  return () => root.unmount()
}
