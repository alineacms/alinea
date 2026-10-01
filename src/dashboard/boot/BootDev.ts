import {Client} from '#/core/Client.js'
import {SharedEventSource} from 'shared-event-source'
import {boot, type ConfigBatch, type ConfigGenerator} from './Boot.js'

export function bootDev() {
  return boot(getConfig())
}

interface Build {
  revision: string
  configFingerprint: string
}

async function* getConfig(): ConfigGenerator {
  let build: Build = {
    revision: process.env.ALINEA_BUILD_ID as string,
    configFingerprint: process.env.ALINEA_CONFIG_FINGERPRINT as string
  }
  const source = new SharedEventSource('./~dev')
  const url = new URL('./api', import.meta.url).href
  const createConfig = async ({revision, configFingerprint}: Build) => {
    const {cms, views} = await loadConfig(revision)
    const {config} = cms
    const client = new Client({config, url})
    return {
      local: true,
      alineaDev: Boolean(process.env.ALINEA_DEV),
      revision,
      configFingerprint,
      config,
      views,
      client
    }
  }
  let batch: ConfigBatch | undefined
  while (true) {
    const next =
      batch?.revision !== build.revision ? await createConfig(build) : batch
    yield next
    batch = next
    build = await new Promise<Build>(resolve => {
      source.addEventListener(
        'message',
        event => {
          console.info(`[reload] received ${event.data}`)
          const info = JSON.parse(event.data)
          switch (info.type) {
            case 'refresh':
              return resolve(info)
            case 'reload':
              if (typeof window === 'undefined') return resolve(info)
              return window.location.reload()
            case 'refetch':
              return resolve(build)
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
