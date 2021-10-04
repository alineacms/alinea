import {Auth} from '@alinea/core/Auth'
import {Schema} from '@alinea/core/Schema'
import {render} from 'react-dom'
import {App} from './App'

export type DashboardOptions = {
  name: string
  schema: Schema
  apiUrl: string
  auth: Auth.View
  color?: string
}

export class Dashboard {
  constructor(protected options: DashboardOptions) {}

  render() {
    const scripts = document.getElementsByTagName('script')
    const element = scripts[scripts.length - 1]
    const div = document.createElement('div')
    div.id = 'root'
    element.parentElement!.replaceChild(div, element)
    render(<App {...this.options} />, div)
  }
}
