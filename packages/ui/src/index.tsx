import React from 'react'
import {render} from 'react-dom'
import {FrontendConfig} from './FrontendConfig'
import {App} from './App'

export function init(config: FrontendConfig) {
  render(<App config={config} />, document.body!)
}
