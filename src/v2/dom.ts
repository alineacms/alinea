import {parseHTML} from 'linkedom'

const {window} = parseHTML('<!doctype html><html><body></body></html>')

globalThis.window = window as any
globalThis.document = window.document as any
Object.defineProperty(globalThis, 'navigator', {
  value: window.navigator,
  configurable: true
})
Object.defineProperty(globalThis, 'location', {
  value: window.location,
  configurable: true
})
Object.defineProperty(globalThis, 'history', {
  value: window.history,
  configurable: true
})
