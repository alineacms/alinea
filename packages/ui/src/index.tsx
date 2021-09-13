import React from 'react'
import {render} from 'react-dom'
import {FrontendConfig} from './FrontendConfig'
import {App} from './App'

export function init(config: FrontendConfig) {
  const element = document.currentScript!
  const div = document.createElement('div')
  div.id = 'root'
  element.parentElement!.replaceChild(div, element)
  render(<App config={config} />, div)
}
