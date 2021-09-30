import {render} from 'react-dom'
import {App, AppProps} from './App'

export class Dashboard {
  constructor(protected options: AppProps) {}

  render() {
    const scripts = document.getElementsByTagName('script')
    const element = scripts[scripts.length - 1]
    const div = document.createElement('div')
    div.id = 'root'
    element.parentElement!.replaceChild(div, element)
    render(<App {...this.options} />, div)
  }
}
