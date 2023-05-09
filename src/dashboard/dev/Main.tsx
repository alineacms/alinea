import {CMS} from 'alinea/core'
import {values} from 'alinea/core/util/Objects'
import type {ReactElement} from 'react'
import {DevDashboard} from './DevDashboard.js'

declare var reactRender: (
  subject: ReactElement,
  into: Element | DocumentFragment
) => void

export function main() {
  const scripts = document.getElementsByTagName('script')
  const element = scripts[scripts.length - 1]
  const into = document.createElement('div')
  into.id = 'root'
  element.parentElement!.replaceChild(into, element)
  reactRender(<DevDashboard loadConfig={loadConfig} />, into)
}

async function loadConfig() {
  const exports = await import('/config.js?' + Math.random())
  for (const member of values(exports)) {
    if (member instanceof CMS) return member
  }
  throw new Error(`No config found in "/config.js"`)
}
