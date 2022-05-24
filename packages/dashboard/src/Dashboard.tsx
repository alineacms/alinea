import {Auth, Config, Hub, Workspaces} from '@alinea/core'
import {QueryClient} from 'react-query'
import {App} from './App'

export interface DashboardOptions<T extends Workspaces = Workspaces> {
  config: Config<T>
  client: Hub<T>
  auth?: Auth.View
  queryClient?: QueryClient
}

export const Dashboard = App
