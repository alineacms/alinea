import {Auth} from '@alinea/core/Auth'
import {Schema} from '@alinea/core/Schema'
import {ComponentType} from 'react'
import {render} from 'react-dom'
import {App} from './App'

export interface DashboardOptions<T> {
  name: string
  schema: Schema<T>
  apiUrl: string
  auth?: Auth.View
  color?: string
  preview?: ComponentType<{entry: T}>
}

export const Dashboard = App

export function renderDashboard<T>(options: DashboardOptions<T>) {
  const scripts = document.getElementsByTagName('script')
  const element = scripts[scripts.length - 1]
  const div = document.createElement('div')
  div.id = 'root'
  element.parentElement!.replaceChild(div, element)
  render(<App {...options} />, div)
}
