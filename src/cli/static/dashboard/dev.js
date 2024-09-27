import '@alinea/generated/views.css'
import 'alinea/css'

import {DevDashboard} from 'alinea/dashboard/dev/DevDashboard'
import {jsx} from 'react/jsx-runtime'
import {reactRender} from './render-react18.js'

const scripts = document.getElementsByTagName('script')
const element = scripts[scripts.length - 1]
const into = document.createElement('div')
into.id = 'root'
element.parentElement.replaceChild(into, element)
reactRender(jsx(DevDashboard, {loadConfig, loadViews}), into)

async function loadConfig() {
  const exports = await import('/config.js?' + Math.random())
  if ('cms' in exports) return exports.cms.config
  throw new Error(`No config found in "/config.js"`)
}

async function loadViews() {
  const exports = await import('/views.js?' + Math.random())
  if ('views' in exports) return exports.views
  throw new Error(`No views found in "/views.js"`)
}
