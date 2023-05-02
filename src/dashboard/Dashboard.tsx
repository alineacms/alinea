import {Config, Hub} from 'alinea/core'
import {QueryClient} from 'react-query'
import {App} from './App.js'

export interface DashboardOptions<T = any> {
  config: Config
  client: Hub<T>
  queryClient?: QueryClient
  fullPage?: boolean
}

export const Dashboard = App
