import {version} from 'react/package.json'
export function main() {
  const scripts = document.getElementsByTagName('script')
  const element = scripts[scripts.length - 1]
  const into = document.createElement('div')
  into.id = 'root'
  element.parentElement!.replaceChild(into, element)
  render(into)
}
async function loadConfig() {
  const {config} = await import('/config.js?' + Math.random())
  return config
}
async function render(into: Element) {
  const isReact18 = Number(version.split('.')[0]) >= 18
  const {renderDashboard} = await (isReact18
    ? import('./react18')
    : import('./react'))
  renderDashboard({loadConfig}, into)
}
