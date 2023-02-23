import {Client} from 'alinea/client'
import 'alinea/css'
import type {ReactElement} from 'react'
import {Dashboard} from './Dashboard'

declare var reactRender: (
  subject: ReactElement,
  into: Element | DocumentFragment
) => void

export async function boot(apiUrl: string) {
  const scripts = document.getElementsByTagName('script')
  const element = scripts[scripts.length - 1]
  const into = document.createElement('div')
  into.id = 'root'
  element.parentElement!.replaceChild(into, element)
  const config = await loadConfig()
  const client = new Client(config, apiUrl)
  reactRender(<Dashboard config={config} client={client} />, into)
}

async function loadConfig() {
  const {config} = await import('./config.js?' + Math.random())
  return config
}
