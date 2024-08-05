import '@alinea/generated/config.css'
import 'alinea/css'

import {Client} from 'alinea/core/Client'
import {App} from 'alinea/dashboard/App'
import {jsx} from 'react/jsx-runtime'
import {reactRender} from './render-react18.js'

export async function boot(handlerUrl) {
  const scripts = document.getElementsByTagName('script')
  const element = scripts[scripts.length - 1]
  const into = document.createElement('div')
  into.id = 'root'
  element.parentElement.replaceChild(into, element)
  const config = await loadConfig()
  const client = new Client({url: handlerUrl})
  reactRender(jsx(App, {config, client}), into)
}

async function loadConfig() {
  const configModule = './config.js?' + Math.random()
  const exports = await import(configModule)
  if ('cms' in exports) return exports.cms.config
  if ('config' in exports) return exports.config
  throw new Error(`No config found in "/config.js"`)
}
