import {Client} from 'alinea/core/Client'
import {type ConfigBatch, type ConfigGenerator, boot} from './Boot.js'

export function bootDev() {
  return boot(getConfig())
}

async function* getConfig(): ConfigGenerator {
  const buildId = process.env.ALINEA_BUILD_ID as string
  let revision = buildId
  const source = new EventSource('/~dev')
  const url = new URL('/api', location.href).href
  const createConfig = async (revision: string) => {
    const {cms, views} = await loadConfig(revision)
    const {config} = cms
    const client = new Client({config, url})
    return {
      local: true,
      alineaDev: Boolean(process.env.ALINEA_DEV),
      revision,
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
  const exports = await import(`/config.js?${revision}`)
  if (!('cms' in exports)) throw new Error(`No config found in "/config.js"`)
  return exports
}
