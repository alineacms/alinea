import {parseHTML} from 'linkedom'

const dom = parseHTML('<!doctype html><html></html>')

globalThis.window = dom
globalThis.document = dom.document
globalThis.navigator = dom.navigator
