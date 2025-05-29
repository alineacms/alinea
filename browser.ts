import {cms} from './apps/dev/src/cms.tsx'
import {Client} from './src/core/Client.js'
import {boot} from './src/dashboard/boot/Boot.tsx'

globalThis.process = {
  env: {}
}

const handlerUrl = '/api'
async function* getConfig() {
  yield {
    local: true,
    revision: 'dev',
    config: cms.config,
    views: {},
    client: new Client({config: cms.config, url: handlerUrl})
  }
}
boot(getConfig())
