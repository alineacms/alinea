import {jsx} from 'react/jsx-runtime'
import {DevDashboard} from '../../../dashboard/dev/DevDashboard.js'
import '../../../index.css'

const scripts = document.getElementsByTagName('script')
const element = scripts[scripts.length - 1]
const into = document.createElement('div')
into.id = 'root'
element.parentElement.replaceChild(into, element)
reactRender(jsx(DevDashboard, {loadConfig}), into)

async function loadConfig() {
  const {config} = await import('/config.js?' + Math.random())
  return config
}
