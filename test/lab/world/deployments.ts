/**
 * Builds and deployments. A build checks out a commit and generates the
 * database the deployment ships, as `alinea build` does; the deployment
 * then serves it from isolates that start on demand. The edge routes each
 * request of the site to one of them.
 */
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {openWasmDatabase} from '#/database/driver/WasmDatabase.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {
  type ConfigVersion,
  configFingerprint,
  labApiKey,
  labConfig
} from '../shared/schema.js'
import {backendDb} from './backendDb.js'
import {bus} from './bus.js'
import {type Commit, github} from './github.js'
import {network} from './network.js'

export type BackendMode = 'self-hosted' | 'cloud'

export interface Deployment {
  id: string
  n: number
  commit: Commit
  configVersion: ConfigVersion
  fingerprint: string
  mode: BackendMode
  driver: 'libsql' | 'd1'
  /** The generated database file the build shipped. */
  database: Uint8Array
  /** The content sha the generated database is at. */
  contentSha: string
  /** Instances of each role, a realm id once the slot started. */
  instances: Record<Role, Array<string | undefined>>
  builtAt: number
}

export type Routing = 'alternate' | 0 | 1

/**
 * What an instance serves: the route handler (`/api/cms`), which the
 * dashboard and the pages sync with, or the server rendered pages of the
 * site. A host runs them as separate functions.
 */
export type Role = 'handler' | 'pages'

export const roles: Array<Role> = ['handler', 'pages']

const roleTitle: Record<Role, string> = {handler: 'handler', pages: 'pages'}

class Deployments {
  node = 'build'
  list: Array<Deployment> = []
  /** How the edge routes requests to the handler. */
  routing: Routing = 'alternate'
  #turn: Record<Role, number> = {handler: 0, pages: 0}
  slots = 2

  get active(): Deployment | undefined {
    return this.list[this.list.length - 1]
  }

  async build(
    commit: Commit,
    configVersion: ConfigVersion,
    mode: BackendMode
  ): Promise<Deployment> {
    const n = this.list.length + 1
    bus.log({
      node: this.node,
      kind: 'build',
      text: `build #${n}: check out ${commit.id.slice(0, 7)}, generate the database with config v${configVersion}`
    })
    const config = labConfig(configVersion)
    const fingerprint = configFingerprint(configVersion)
    const handle = await openWasmDatabase()
    await EntryDatabase.createSchema(
      handle.database,
      config,
      ReadonlyTree.EMPTY.sha,
      fingerprint
    )
    const database = new EntryDatabase(config, handle.database)
    const store = new EntryStore(config, database, new MemorySource())
    const contentSha = await store.syncWith(github.sourceAt(commit))
    await database.compact({rewrite: true})
    const bytes = handle.export()
    await store.close()
    await database.close()
    const deployment: Deployment = {
      id: `d${n}`,
      n,
      commit,
      configVersion,
      fingerprint,
      mode,
      driver: backendDb.driver,
      database: bytes,
      contentSha,
      instances: {
        handler: Array(this.slots).fill(undefined),
        pages: Array(this.slots).fill(undefined)
      },
      builtAt: bus.now()
    }
    const previous = this.active
    this.list.push(deployment)
    bus.log({
      node: this.node,
      kind: 'deploy',
      text: `deployment #${n} is live: generated database at ${contentSha.slice(0, 7)} (${Math.round(bytes.length / 1024)} KiB), ${mode} backend`
    })
    if (previous) this.retire(previous)
    bus.changed()
    return deployment
  }

  retire(deployment: Deployment) {
    for (const role of roles) {
      for (const id of deployment.instances[role]) if (id) network.terminate(id)
      deployment.instances[role] = deployment.instances[role].map(
        () => undefined
      )
    }
    bus.log({
      node: this.node,
      kind: 'retire',
      text: `deployment #${deployment.n} retired, its instances stop`
    })
  }

  instanceNode(role: Role, slot: number) {
    return `${role}-${slot + 1}`
  }

  /** The realm of an instance of the active deployment, started on demand. */
  instance(role: Role, slot: number): string {
    const deployment = this.active
    if (!deployment) throw new Error('Nothing is deployed')
    const existing = deployment.instances[role][slot]
    if (existing) return existing
    const id = `${deployment.id}-${role}-${slot + 1}`
    const node = this.instanceNode(role, slot)
    bus.setState(node, {cold: true})
    bus.log({
      node,
      kind: 'cold-start',
      text: `cold start of ${roleTitle[role]} λ${slot + 1} for deployment #${deployment.n}`
    })
    network.spawn(
      {
        id,
        kind: 'isolate',
        env: {
          NODE_ENV: 'production',
          NEXT_RUNTIME: 'nodejs',
          NEXT_PHASE: 'phase-production-server',
          ALINEA_API_KEY: labApiKey,
          ALINEA_CLOUD_URL: 'https://cloud.lab'
        },
        data: {
          deployment: deployment.id,
          configVersion: deployment.configVersion,
          mode: deployment.mode,
          driver: deployment.driver
        }
      },
      node,
      name =>
        new Worker(new URL('../workers/isolate.ts', import.meta.url), {
          type: 'module',
          name
        })
    )
    deployment.instances[role][slot] = id
    bus.changed()
    return id
  }

  /** Stop an instance, as a host does after it idled. */
  stop(role: Role, slot: number) {
    const deployment = this.active
    const id = deployment?.instances[role][slot]
    if (!deployment || !id) return
    network.terminate(id)
    deployment.instances[role][slot] = undefined
    const node = this.instanceNode(role, slot)
    bus.setState(node, undefined)
    bus.log({
      node,
      kind: 'stop',
      text: `${roleTitle[role]} λ${slot + 1} stopped: its database copy is gone`
    })
  }

  /** The instance the edge sends the next request to. */
  pick(role: Role): number {
    if (role === 'handler' && this.routing !== 'alternate') return this.routing
    const slot = this.#turn[role] % this.slots
    this.#turn[role]++
    return slot
  }
}

export const deployments = new Deployments()

network.rpc('deployment.database', ({deployment}: {deployment: string}) => {
  const found = deployments.list.find(d => d.id === deployment)
  if (!found) throw new Error(`No deployment ${deployment}`)
  return found.database
})

// Every request to the site's handler url reaches an instance of the handler
network.route(url => {
  if (url.host !== 'site.lab') return
  const slot = deployments.pick('handler')
  const realm = deployments.instance('handler', slot)
  return {
    node: deployments.instanceNode('handler', slot),
    handle: request => network.call(realm, 'request', request)
  }
})
