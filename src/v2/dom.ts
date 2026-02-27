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
Object.defineProperty(globalThis, 'Node', {
  value: (window as any).Node,
  configurable: true
})
Object.defineProperty(globalThis, 'Element', {
  value: (window as any).Element,
  configurable: true
})
Object.defineProperty(globalThis, 'HTMLElement', {
  value: (window as any).HTMLElement,
  configurable: true
})

const elementProto = (window as any).HTMLElement?.prototype
if (elementProto && !elementProto.setCustomValidity) {
  elementProto.setCustomValidity = function setCustomValidity() {}
}
if (elementProto && !elementProto.checkValidity) {
  elementProto.checkValidity = function checkValidity() {
    return true
  }
}
if (elementProto && !elementProto.reportValidity) {
  elementProto.reportValidity = function reportValidity() {
    return true
  }
}
if (elementProto && !Object.getOwnPropertyDescriptor(elementProto, 'validity')) {
  Object.defineProperty(elementProto, 'validity', {
    get() {
      return {valid: true}
    },
    configurable: true
  })
}
if (
  elementProto &&
  !Object.getOwnPropertyDescriptor(elementProto, 'validationMessage')
) {
  Object.defineProperty(elementProto, 'validationMessage', {
    get() {
      return ''
    },
    configurable: true
  })
}
