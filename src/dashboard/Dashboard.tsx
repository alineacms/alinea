import {Config, Connection} from 'alinea/core'
import {QueryClient} from 'react-query'
import {App} from './App.js'

export interface DashboardOptions {
  config: Config
  client: Connection
  queryClient?: QueryClient
  fullPage?: boolean
}

export const Dashboard = App
