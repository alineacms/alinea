import {databaseVersion} from '#/database/Version.js'
import * as Comlink from 'comlink'
import type {CacheConfigName} from './CacheConfig.js'
import {seeded} from './CacheConfig.js'
import {CacheServer} from './CacheServer.js'
import type {CacheBase, CacheBuild} from './CacheWorker.js'

export interface Cache {
  version: number
  seeded: number
  /** A worker per name, as the SharedWorker of a dashboard build. */
  build(name: string): Comlink.Remote<CacheBuild>
  load(name: string, config: CacheConfigName): Promise<void>
  errors(): Promise<Array<string>>
  bases(): Promise<Array<CacheBase>>
  databases(): Promise<Array<string>>
  create(database: string): Promise<void>
}

declare global {
  var cache: Cache
}

// Worker names of its own keep a page off workers that another one started.
const run = crypto.randomUUID()
const server = CacheServer.create()
const builds = new Map<string, Comlink.Remote<CacheBuild>>()

function build(name: string): Comlink.Remote<CacheBuild> {
  const existing = builds.get(name)
  if (existing) return existing
  const worker = new SharedWorker(
    new URL('./CacheWorker.ts', import.meta.url),
    {type: 'module', name: `${run}-${name}`}
  )
  const remote = Comlink.wrap<CacheBuild>(worker.port)
  builds.set(name, remote)
  return remote
}

globalThis.cache = {
  version: databaseVersion,
  seeded,
  build,
  async load(name, config) {
    const {port1, port2} = new MessageChannel()
    Comlink.expose(await server, port1)
    await build(name).load(config, Comlink.transfer(port2, [port2]))
  },
  async errors() {
    const errors = await Promise.all([...builds.values()].map(b => b.errors()))
    return errors.flat()
  },
  bases() {
    return build('inspect').bases()
  },
  async databases() {
    const databases = await indexedDB.databases()
    return databases.flatMap(({name}) => (name ? [name] : []))
  },
  create(database) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(database, 1)
      request.onupgradeneeded = () => request.result.createObjectStore('data')
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }
}

export function CacheHarness() {
  return <p>cache</p>
}
