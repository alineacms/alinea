import {Client} from '#/core/Client.js'
import {SharedEventSource} from 'shared-event-source'
import {boot, type ConfigBatch, type ConfigGenerator} from './Boot.js'
import {replicaBinding} from './ReplicaBinding.js'
import {DevConfigUpdates} from './DevConfigUpdates.js'

export function bootDev() {
  return boot(getConfig())
}

async function* getConfig(): ConfigGenerator {
  const buildId = process.env.ALINEA_BUILD_ID as string
  let revision =
    new URL(import.meta.url).searchParams.get('configRevision') ?? buildId
  const source = new SharedEventSource('./~dev')
  const updates = new DevConfigUpdates(
    source,
    revision,
    typeof window === 'undefined' ? undefined : () => window.location.reload()
  )
  const url = new URL('./api', import.meta.url).href
  const createConfig = async (revision: string) => {
    const {cms, views, dashboardReplica} = await loadConfig(revision)
    const {config} = cms
    const client = new Client({config, url})
    return {
      local: true,
      alineaDev: Boolean(process.env.ALINEA_DEV),
      revision,
      config,
      views,
      client,
      replica: replicaBinding(dashboardReplica),
      handlerUrl: url
    }
  }
  try {
    let batch: ConfigBatch | undefined
    while (true) {
      const next =
        batch?.revision !== revision ? await createConfig(revision) : batch
      yield next
      batch = next
      revision = await updates.next()
    }
  } finally {
    updates.close()
    source.close()
  }
}

async function loadConfig(revision: string) {
  const url = new URL(`./config.js?${revision}`, import.meta.url)
  const exports = await import(url.href)
  if (!('cms' in exports)) throw new Error(`No config found in "/config.js"`)
  return exports
}
