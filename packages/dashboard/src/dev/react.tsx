import {render} from 'react-dom'
import {DevDashboard, DevDashboardOptions} from './DevDashboard'

export function renderDashboard(
  options: DevDashboardOptions,
  into: Element | DocumentFragment
) {
  render(<DevDashboard {...options} />, into)
  return () => render(null!, into)
}
