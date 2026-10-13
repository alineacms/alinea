/**
 * The shared worker of a browser's dashboard tabs, as `alinea build` ships
 * it: `loadWorker` exposes a `DashboardWorker` on a browser store (WASM
 * SQLite over bases kept in IndexedDB) to every tab that connects.
 */
import {identity, trace} from '../shared/realm.js'
import {Client} from '#/core/Client.js'
import {loadWorker} from '#/dashboard/boot/LoadWorker.js'
import {BrowserEntryStore} from '#/database/BrowserEntryStore.js'
import {instrument, label} from '../shared/instrument.js'
import {
  type ConfigVersion,
  configFingerprint,
  handlerUrl,
  labConfig
} from '../shared/schema.js'

instrument()

const data = identity.data as {
  browser: string
  user: string
  build: string
  configVersion: ConfigVersion
}

// Label the store the worker opens, and report how it opened.
const open = BrowserEntryStore.open
BrowserEntryStore.open = async function (config, options) {
  const store = await open.call(this, config, options)
  label(store, 'worker')
  const tree = await store.source.getTree()
  trace({
    node: 'worker',
    kind: 'open',
    text: tree.isEmpty
      ? `opened an empty browser store (no stored base for ${options.fingerprint})`
      : `opened stored base at ${(await store.sha).slice(0, 7)}`
  })
  return store
}

const config = labConfig(data.configVersion)
const authorization = `Basic ${btoa(`${data.user}:password`)}`

async function* configs() {
  yield {
    local: false,
    revision: data.build,
    configFingerprint: configFingerprint(data.configVersion),
    config,
    views: {},
    client: new Client({
      config,
      url: handlerUrl,
      applyAuth(init) {
        const headers = new Headers(init?.headers)
        headers.set('authorization', authorization)
        return {...init, headers}
      }
    })
  }
}

loadWorker(configs())
