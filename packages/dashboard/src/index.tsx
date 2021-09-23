import {render} from 'react-dom'
import {App} from './App'
import {FrontendConfig} from './FrontendConfig'

export function init(config: FrontendConfig) {
  const scripts = document.getElementsByTagName('script')
  const element = scripts[scripts.length - 1]
  const div = document.createElement('div')
  div.id = 'root'
  element.parentElement!.replaceChild(div, element)
  render(<App config={config} />, div)
}
