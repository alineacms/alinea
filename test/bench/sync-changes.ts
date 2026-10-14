/**
 * Compares the two ways a store behind the latest content syncs through the
 * handler: taking the whole latest tree, then asking for the changed blobs,
 * or asking for the changes since its own tree, which come with their
 * contents. The site is the generated one of the initial sync benchmark; each
 * round changes a few files on the server, then both stores catch up.
 *
 *   bun test/bench/sync-changes.ts [files] [changed files] [rounds]
 */
import {MissingCredentialsError} from '#/backend/Auth.js'
import {createHandler} from '#/backend/Handler.js'
import {Client} from '#/core/Client.js'
import type {RemoteConnection} from '#/core/Connection.js'
import type {Change} from '#/core/source/Change.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {DatabaseSource} from '#/database/DatabaseSource.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {openWasmDatabase} from '#/database/driver/WasmDatabase.js'
import {cms} from './initial-sync.cms.js'
import {content} from './initial-sync.content.js'

const size = Number(process.argv[2] ?? 12_000)
const changed = Number(process.argv[3] ?? 5)
const rounds = Number(process.argv[4] ?? 5)
const {config} = cms

async function add(path: string, contents: Uint8Array): Promise<Change> {
  return {op: 'add', path, sha: await hashBlob(contents), contents}
}

/** A store syncing into WASM SQLite, as the dashboard and a page do. */
async function store() {
  const {database: db, fork} = await openWasmDatabase()
  await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
  const database = new EntryDatabase(config, db, {fork})
  return new EntryStore(config, database, new DatabaseSource(database), {
    ownsDatabase: true,
    sourceFollowsDatabase: true
  })
}

const files = content(size)
const source = new MemorySource()
await source.applyChanges({
  fromSha: ReadonlyTree.EMPTY.sha,
  changes: await Promise.all(files.map(file => add(file.path, file.contents)))
})
const server = await store()
await server.syncWith(source, {validate: false})

const remote = {
  async verify() {
    throw new MissingCredentialsError('No user')
  },
  getTreeIfDifferent: (sha: string) => source.getTreeIfDifferent(sha),
  getBlobs: (shas: ReadonlyArray<string>) => source.getBlobs(shas)
} as unknown as RemoteConnection
const handler = createHandler({cms, db: server, remote: () => remote})

/** Bytes and requests on the wire since the last reset. */
const wire = {bytes: 0, requests: 0}
const http = Bun.serve({
  port: 0,
  async fetch(request) {
    const response = await handler(request, {
      isDev: false,
      handlerUrl: new URL(request.url),
      apiKey: 'bench'
    })
    wire.requests++
    if (!response.body) return response
    const counted = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        wire.bytes += chunk.length
        controller.enqueue(chunk)
      }
    })
    return new Response(response.body.pipeThrough(counted), response)
  }
})
const client = new Client({
  config,
  url: `http://localhost:${http.port}/api`,
  applyAuth: init => ({
    ...init,
    headers: {...init?.headers, authorization: 'Bearer bench'}
  })
})
/** The client as it was: it has no getChanges. */
const treeClient: RemoteSource = {
  getTreeIfDifferent: sha => client.getTreeIfDifferent(sha),
  getBlobs: (shas, options) => client.getBlobs(shas, options)
}

const viaTree = await store()
const viaChanges = await store()
await viaTree.syncWith(source, {validate: false})
await viaChanges.syncWith(source, {validate: false})

const tree = await source.getTree()
console.log(`${size} files, tree of ${JSON.stringify(tree).length} bytes`)
console.log(`${changed} files change in each of ${rounds} rounds\n`)

const encoder = new TextEncoder()
const results = {tree: Array<Row>(), changes: Array<Row>()}
interface Row {
  ms: number
  bytes: number
  requests: number
}

async function measure(sync: () => Promise<unknown>): Promise<Row> {
  wire.bytes = 0
  wire.requests = 0
  const start = performance.now()
  await sync()
  return {ms: performance.now() - start, ...wire}
}

for (let round = 1; round <= rounds; round++) {
  const current = await source.getTree()
  const paths = [...current.index().keys()]
  const edits = await Promise.all(
    Array.from({length: changed}, (_, i) => {
      const at = Math.floor(((i + round / rounds) * paths.length) / changed)
      const path = paths[at % paths.length]
      const record = JSON.parse(
        new TextDecoder().decode(
          files.find(file => file.path === path)!.contents
        )
      )
      const contents = encoder.encode(
        JSON.stringify({...record, title: `${record.title} ${round}`}, null, 2)
      )
      return add(path, contents)
    })
  )
  await source.applyChanges({fromSha: current.sha, changes: edits})
  await server.syncWith(source, {validate: false})
  results.tree.push(await measure(() => viaTree.syncWith(treeClient)))
  results.changes.push(await measure(() => viaChanges.syncWith(client)))
  const latest = (await source.getTree()).sha
  if ((await viaTree.sha) !== latest || (await viaChanges.sha) !== latest)
    throw new Error('A store did not reach the latest tree')
}

function average(rows: Array<Row>, key: keyof Row) {
  return rows.reduce((sum, row) => sum + row[key], 0) / rows.length
}

function kb(bytes: number) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

console.log('per sync      ms      on the wire  requests')
for (const [label, rows] of Object.entries(results))
  console.log(
    [
      label.padEnd(8),
      average(rows, 'ms').toFixed(1).padStart(7),
      kb(average(rows, 'bytes')).padStart(16),
      average(rows, 'requests').toFixed(0).padStart(9)
    ].join(' ')
  )

http.stop(true)
await Promise.all([server.close(), viaTree.close(), viaChanges.close()])
