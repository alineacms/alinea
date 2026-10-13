import type {LocalConnection} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {DashboardWorker} from '#/dashboard/boot/DashboardWorker.js'
import {wasmSqlite} from '#/database/driver/WasmDatabase.js'
import {versionedCacheName} from '#/database/Version.js'
import {createTestConnection} from '#test/CreateConnection.js'
import type {Database} from '@alinea/sqlite-wasm/Database.js'
import {indexedDBSnapshots} from '@alinea/sqlite-wasm/snapshots'
import * as Comlink from 'comlink'
import {cacheConfig, type CacheConfigName} from './CacheConfig.js'
import type {CacheServer} from './CacheServer.js'

export interface CacheBase {
  key: string
  branch: string
  tree: unknown
  /** The snapshot a delta lies over. */
  parent?: string
  size: number
  /** Bytes stored: the changed pages of a delta, else the whole database. */
  bytes: number
  integrity: string
}

const worker = new DashboardWorker()
const errors: Array<string> = []
let fetched = 0

addEventListener('error', event => {
  if (event instanceof ErrorEvent) errors.push(event.message)
})
addEventListener('unhandledrejection', event => {
  if (event instanceof PromiseRejectionEvent) errors.push(String(event.reason))
})

function connect(server: Comlink.Remote<CacheServer>): LocalConnection {
  const remote: Pick<LocalStore, 'mutate' | 'getTreeIfDifferent' | 'getBlobs'> =
    {
      mutate: mutations => server.mutate(mutations),
      async getTreeIfDifferent(sha) {
        const tree = await server.tree(sha)
        return tree && new ReadonlyTree(tree)
      },
      async *getBlobs(shas) {
        fetched += shas.length
        yield* await server.blobs([...shas])
      }
    }
  // The dashboard worker only syncs from and mutates the remote.
  return createTestConnection(remote as LocalStore)
}

/**
 * Read every table and index of `db` in full. This SQLite build leaves out
 * `pragma integrity_check`, and a damaged page fails the query that reads it.
 */
function check(db: Database): string {
  const [schema] = db.exec(
    `select type, name, tbl_name from sqlite_schema
     where type in ('table', 'index')
     and coalesce(sql, '') not like 'create virtual%'
     and coalesce(sql, '') not like '% where %'`
  )
  try {
    for (const [type, name, table] of schema?.values ?? [])
      db.exec(
        type === 'table'
          ? `select * from "${name}"`
          : `select count(*) from "${table}" indexed by "${name}"`
      )
    return 'ok'
  } catch (error) {
    return String(error)
  }
}

const build = {
  load(name: CacheConfigName, port: MessagePort): Promise<void> {
    const server = Comlink.wrap<CacheServer>(port)
    return worker.load(`config-${name}`, cacheConfig(name), connect(server))
  },
  sync(): Promise<string> {
    return worker.sync()
  },
  queue(id: string, mutations: Array<Mutation>): Promise<string> {
    return worker.queue(id, mutations)
  },
  /** Wait for queued mutations to reach the remote, return their errors. */
  async flushed(): Promise<Array<string>> {
    const busy = () =>
      worker
        .activities()
        .some(({status}) => status === 'pending' || status === 'running')
    while (busy()) await new Promise(resolve => setTimeout(resolve, 10))
    return worker.activities().flatMap(({error}) => (error ? [error] : []))
  },
  async count(): Promise<number> {
    return (await worker.db).count({})
  },
  async title(id: string): Promise<string | null> {
    return (await worker.db).first({id, select: Entry.title})
  },
  async search(term: string): Promise<number> {
    return (await worker.db).count({search: term})
  },
  fetched(): number {
    return fetched
  },
  errors(): Array<string> {
    return errors
  },
  /** The stored bases, newest first, each checked for corruption. */
  async bases(): Promise<Array<CacheBase>> {
    const storage = indexedDBSnapshots(
      `${versionedCacheName('alinea-entry-database')}-snapshots`
    )
    const Database = await wasmSqlite()
    const bases = await Promise.all(
      (await storage.list()).map(async ({key, branch, meta, size, parent}) => {
        const stored = await storage.store.get(key)
        // Retain may delete a snapshot after it was listed.
        if (!stored) return []
        const bytes =
          stored.source instanceof Blob
            ? stored.source.size
            : stored.source.byteLength
        const integrity = await storage.open(Database, {key}).then(
          async session => {
            try {
              return check(session.db)
            } finally {
              await session.close()
            }
          },
          async error =>
            (await storage.store.get(key)) ? String(error) : undefined
        )
        if (integrity === undefined) return []
        return [{key, branch, tree: meta.tree, parent, size, bytes, integrity}]
      })
    )
    return bases.flat()
  }
}

export type CacheBuild = typeof build

addEventListener('connect', event => {
  if (event instanceof MessageEvent) Comlink.expose(build, event.ports[0])
})
