import {Config, Connection} from 'alinea/core'
import {QueryClient} from 'react-query'
import {App} from './App.js'

export interface DashboardOptions<T = any> {
  config: Config
  client: Connection<T>
  queryClient?: QueryClient
  fullPage?: boolean
}

export const Dashboard = App
