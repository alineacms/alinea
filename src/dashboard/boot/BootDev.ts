import {Client} from '#/core/Client.js'
import {Policy} from '#/core/Role.js'
import {localUser} from '#/core/User.js'
import {SharedEventSource} from 'shared-event-source'
import {boot, type ConfigBatch, type ConfigGenerator} from './Boot.js'

export function bootDev() {
  return boot(getConfig())
}

async function* getConfig(): ConfigGenerator {
  const buildId = process.env.ALINEA_BUILD_ID as string
  let revision = buildId
  const source = new SharedEventSource('./~dev')
  const url = new URL('./api', import.meta.url).href
  const createConfig = async (revision: string) => {
    const {cms, views} = await loadConfig(revision)
    const {config} = cms
    const client = new Client({config, url})
    const state = await client.contentState()
    if (!state) throw new Error('Content state was not available')
    const userData = process.env.ALINEA_USER as string | undefined
    const user = userData ? JSON.parse(userData) : localUser
    return {
      local: true,
      alineaDev: Boolean(process.env.ALINEA_DEV),
      revision,
      configId: state.configId,
      cacheKey: `dev-${state.configId}-${user.sub}`,
      user,
      policy: Policy.import(state.policy),
      config,
      views,
      client
    }
  }
  let batch: ConfigBatch | undefined
  while (true) {
    const next =
      batch?.revision !== revision ? await createConfig(revision) : batch
    yield next
    batch = next
    revision = await new Promise<string>(resolve => {
      source.addEventListener(
        'message',
        event => {
          console.info(`[reload] received ${event.data}`)
          const info = JSON.parse(event.data)
          switch (info.type) {
            case 'refresh':
              return resolve(info.revision)
            case 'reload':
              if (typeof window === 'undefined') return resolve(info.revision)
              return window.location.reload()
            case 'refetch':
              return resolve(revision)
          }
        },
        {once: true}
      )
    })
  }
}

async function loadConfig(revision: string) {
  const url = new URL(`./config.js?${revision}`, import.meta.url)
  const exports = await import(url.href)
  if (!('cms' in exports)) throw new Error(`No config found in "/config.js"`)
  return exports
}
