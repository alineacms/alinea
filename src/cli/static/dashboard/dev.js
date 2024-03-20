import '@alinea/generated/config.css'
import 'alinea/css'

import {DevDashboard} from 'alinea/dashboard/dev/DevDashboard'
import {jsx} from 'react/jsx-runtime'
import {reactRender} from './render-react18.js'

const scripts = document.getElementsByTagName('script')
const element = scripts[scripts.length - 1]
const into = document.createElement('div')
into.id = 'root'
element.parentElement.replaceChild(into, element)
reactRender(jsx(DevDashboard, {loadConfig}), into)

async function loadConfig() {
  const exports = await import('/config.js?' + Math.random())
  if ('cms' in exports) return exports.cms.config
  if ('config' in exports) return exports.config
  throw new Error(`No config found in "/config.js"`)
}
