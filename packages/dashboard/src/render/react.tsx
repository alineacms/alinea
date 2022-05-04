import type {Workspaces} from '@alinea/core'
import {render} from 'react-dom'
import {Dashboard, DashboardOptions} from '../Dashboard'

export function renderDashboard<T extends Workspaces>(
  options: DashboardOptions<T>
) {
  const scripts = document.getElementsByTagName('script')
  const element = scripts[scripts.length - 1]
  const div = document.createElement('div')
  div.id = 'root'
  element.parentElement!.replaceChild(div, element)
  render(<Dashboard {...options} />, div)
}

export default renderDashboard
