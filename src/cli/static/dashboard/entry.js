import {CMS} from 'alinea/core'
import {Client} from 'alinea/core/Client'
import 'alinea/css'
import {App} from 'alinea/dashboard/App'
import {jsx} from 'react/jsx-runtime'
import {reactRender} from './render-react18.js'

export async function boot(apiUrl) {
  const scripts = document.getElementsByTagName('script')
  const element = scripts[scripts.length - 1]
  const into = document.createElement('div')
  into.id = 'root'
  element.parentElement.replaceChild(into, element)
  const config = await loadConfig()
  const client = new Client({config, url: apiUrl})
  reactRender(jsx(App, {config, client}), into)
}

async function loadConfig() {
  const exports = await import('./config.js?' + Math.random())
  for (const member of Object.values(exports)) {
    if (member instanceof CMS) return member
  }
  throw new Error(`No config found in "/config.js"`)
}
