import {Auth, Config, Hub, Workspaces} from '@alinea/core'
import {App} from './App'

export interface DashboardOptions<T extends Workspaces = Workspaces> {
  config: Config<T>
  client: Hub<T>
  auth?: Auth.View
}

export const Dashboard = App
