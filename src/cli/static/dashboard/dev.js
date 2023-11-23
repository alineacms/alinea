import {CMS} from 'alinea/core'
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
  for (const member of Object.values(exports)) {
    if (member instanceof CMS) return member
  }
  throw new Error(`No config found in "/config.js"`)
}
