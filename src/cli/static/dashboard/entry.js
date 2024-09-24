import '@alinea/generated/views.css'
import 'alinea/css'

import {cms} from '@alinea/generated/config.js'
import {views} from '@alinea/generated/views.js'

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
  const config = cms.config
  const client = new Client({url: handlerUrl})
  reactRender(jsx(App, {config, views, client}), into)
}
