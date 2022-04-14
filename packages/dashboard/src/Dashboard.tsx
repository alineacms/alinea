import {Auth, Config, Hub, Workspaces} from '@alinea/core'
import {createRoot} from 'react-dom/client'
import {App} from './App'

export interface DashboardOptions<T extends Workspaces = Workspaces> {
  config: Config<T>
  client: Hub<T>
  auth?: Auth.View
}

export const Dashboard = App

export function renderDashboard<T extends Workspaces>(
  options: DashboardOptions<T>
) {
  const scripts = document.getElementsByTagName('script')
  const element = scripts[scripts.length - 1]
  const div = document.createElement('div')
  div.id = 'root'
  element.parentElement!.replaceChild(div, element)
  createRoot(div).render(<App {...options} />)
}
