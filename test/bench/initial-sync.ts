/**
 * Measures the initial dashboard sync of a large project: an empty browser
 * database (WASM SQLite) syncing from a handler that serves a generated
 * database over HTTP, as the dashboard does on its first load. The generated
 * files form a multilingual site with nested pages, linked rich text, blocks
 * and a large media library.
 *
 * Requests can pay a fixed overhead, such as a serverless handler that syncs
 * before it answers, and share a bandwidth limit.
 *
 * With --browser it syncs a browser store kept as snapshots in IndexedDB in
 * a worker in Chromium, as the dashboard does: an initial sync, a reload,
 * syncs of 1, 100 and 1000 changes on the server, then of 10 until the
 * head lies over the most deltas it may, a reload over those deltas, and a
 * store of another config deriving its entries from the stored ones. Each phase runs in a worker of its own, so
 * the Wasm heap it reports, which never shrinks, is its peak. There is no
 * profile of the browser run: Playwright opens CDP sessions on pages only,
 * not on workers.
 *
 *   bun test/bench/initial-sync.ts [files] [overhead ms] [bandwidth MB/s]
 *     [--browser]
 */
import {MissingCredentialsError} from '#/backend/Auth.js'
import {createHandler} from '#/backend/Handler.js'
import {createGeneratedDatabase} from '#/backend/store/GeneratedDatabase.js'
import type {Change} from '#/core/source/Change.js'
import {decodeBlobSequence, encodeBlobSequence} from '#/core/BlobTransport.js'
import {Client} from '#/core/Client.js'
import type {RemoteConnection} from '#/core/Connection.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {chunks} from '#/core/util/Arrays.js'
import {accumulate} from '#/core/util/Async.js'
import {DatabaseSource} from '#/database/DatabaseSource.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {runtimeDatabase} from '#/database/driver/RuntimeDatabase.js'
import {openWasmDatabase} from '#/database/driver/WasmDatabase.js'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {cms} from './initial-sync.cms.js'
import {content} from './initial-sync.content.js'
import type {Phase, Row} from './initial-sync.worker.js'

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'))
const browser = process.argv.includes('--browser')
const size = Number(args[0] ?? 20_000)
const overhead = Number(args[1] ?? 0)
const bandwidth = Number(args[2] ?? 0) * 1024 * 1024

const {config} = cms

/** The files of the generated site, as the server has them. */
const files = new Map<string, Uint8Array>()

/** The generated site as a source. */
async function generate() {
  for (const file of content(size)) files.set(file.path, file.contents)
  const source = new MemorySource()
  const changes = await Promise.all(
    Array.from(files, ([path, contents]) => add(path, contents))
  )
  await source.applyChanges({fromSha: ReadonlyTree.EMPTY.sha, changes})
  return source
}

async function add(path: string, contents: Uint8Array): Promise<Change> {
  return {op: 'add', path, sha: await hashBlob(contents), contents}
}

/** Spread `count` picks over `list`, starting at `offset`. */
function spread<T>(list: Array<T>, count: number, offset: number): Array<T> {
  return Array.from(
    {length: count},
    (_, i) =>
      list[(Math.floor((i * list.length) / count) + offset) % list.length]
  )
}

let round = 0

/**
 * Change `count` files spread over the site: one in ten adds a copy of a
 * media file, one in ten removes one, and the rest edit the title of a page,
 * article or person.
 */
async function change(source: MemorySource, count: number): Promise<string> {
  round++
  const paths = [...files.keys()]
  const isMedia = (path: string) => /\/file-\d+\.json$/.test(path)
  const media = paths.filter(isMedia)
  const entries = paths.filter(path => !isMedia(path))
  const adds = Math.floor(count / 10)
  const removes = adds
  const edits = count - adds - removes
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const read = (path: string) => JSON.parse(decoder.decode(files.get(path)))
  const write = (path: string, record: object) =>
    add(path, encoder.encode(JSON.stringify(record, null, 2)))
  const changes = await Promise.all([
    ...spread(entries, edits, round).map(path => {
      const record = read(path)
      return write(path, {...record, title: `${record.title} ${round}`})
    }),
    ...spread(media, adds, round * 7).map(path => {
      const record = read(path)
      return write(path.replace('.json', `-copy-${round}.json`), {
        ...record,
        _id: `${record._id}-copy-${round}`
      })
    }),
    ...spread(media, removes, round * 13 + 5).map(
      async (path): Promise<Change> => ({
        op: 'delete',
        path,
        sha: await hashBlob(files.get(path)!)
      })
    )
  ])
  const tree = await source.getTree()
  await source.applyChanges({fromSha: tree.sha, changes})
  for (const change of changes)
    if (change.op === 'add') files.set(change.path, change.contents!)
    else files.delete(change.path)
  if (count === 1) return '1 change'
  return `${count} changes (${edits} edits, ${adds} adds, ${removes} removes)`
}

/** A browser store: WASM SQLite whose source is its own database. */
async function browserStore() {
  const handle = await openWasmDatabase()
  const {database: db, fork} = handle
  await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
  const database = new EntryDatabase(config, db, {fork})
  const store = new EntryStore(config, database, new DatabaseSource(database), {
    ownsDatabase: true,
    sourceFollowsDatabase: true
  })
  return {store, handle}
}

const bundles = new Map<string, Promise<Blob>>()
function bundle(name: 'page' | 'worker') {
  if (!bundles.has(name))
    bundles.set(
      name,
      Bun.build({
        entrypoints: [join(import.meta.dir, `initial-sync.${name}.ts`)],
        target: 'browser',
        define: {'process.env.NODE_ENV': '"production"'}
      }).then(result => {
        if (!result.success) throw new AggregateError(result.logs)
        return result.outputs[0]
      })
    )
  return bundles.get(name)!
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Every response shares one link of the configured bandwidth. */
let linkFree = 0
function throttle() {
  return new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      const now = performance.now()
      linkFree = Math.max(linkFree, now) + (chunk.length / bandwidth) * 1000
      await sleep(linkFree - now)
      controller.enqueue(chunk)
    }
  })
}

const columns: Array<[label: string, format: (row: Row) => string]> = [
  ['ms', row => fixed(row.ms)],
  ['blobs', row => fixed(row.blobs)],
  ['stored ms', row => fixed(row.stored)],
  ['written', row => bytes(row.written)],
  ['reads', row => fixed(row.reads)],
  ['read', row => bytes(row.read)],
  ['read ms', row => fixed(row.reading)],
  ['snapshots', row => fixed(row.snapshots)],
  ['chain', row => fixed(row.chain)],
  ['all stored', row => bytes(row.size)],
  ['heap', row => bytes(row.heap)]
]

function fixed(value: number | undefined) {
  return value === undefined ? '' : value.toFixed(0)
}

function bytes(value: number | undefined) {
  if (value === undefined) return ''
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

/** Print the columns that any of `rows` has. */
function table(title: string, rows: Array<Row>) {
  const used = columns.filter(([, format]) => rows.some(row => format(row)))
  const width = Math.max(...rows.map(row => row.step.length))
  const cells = (step: string, values: Array<string>) =>
    [step.padEnd(width), ...values.map(value => value.padStart(10))].join(' ')
  console.log(`\n${title}`)
  console.log(
    cells(
      '',
      used.map(([label]) => label)
    )
  )
  for (const row of rows)
    console.log(
      cells(
        row.step,
        used.map(([, format]) => format(row))
      )
    )
}

async function time<T>(label: string, run: () => Promise<T>) {
  const start = performance.now()
  const result = await run()
  console.log(
    `${label.padEnd(52)} ${(performance.now() - start).toFixed(0).padStart(6)} ms`
  )
  return result
}

const dir = await mkdtemp(join(tmpdir(), 'alinea-sync-bench-'))
const path = join(dir, 'generated.sqlite')
try {
  const source = await time(`generate ${size} files`, generate)
  const tree = await source.getTree()
  const shas = [...new Set(tree.index().values())]
  const blobs = await accumulate(source.getBlobs(shas))
  const bytes = blobs.reduce((sum, [, blob]) => sum + blob.length, 0)
  console.log(
    `${shas.length} blobs, ${(bytes / 1024 / 1024).toFixed(1)} MB of JSON\n`
  )

  await time('build the generated database (native)', async () => {
    const {database: db} = await runtimeDatabase({path})
    await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
    const store = new EntryStore(
      config,
      new EntryDatabase(config, db),
      new MemorySource(),
      {ownsDatabase: true}
    )
    await store.syncWith(source)
    await store.close()
  })

  const server = await createGeneratedDatabase(
    config,
    await runtimeDatabase({path})
  )
  const remote = {
    async verify() {
      throw new MissingCredentialsError('No user')
    },
    async getTreeIfDifferent() {
      return undefined
    }
  } as unknown as RemoteConnection
  const handler = createHandler({cms, db: server, remote: () => remote})
  const requests = new Map<string, {count: number; ms: number}>()
  const http = Bun.serve({
    port: 0,
    async fetch(request) {
      const {pathname} = new URL(request.url)
      if (pathname === '/')
        return new Response('<script type="module" src="/page.js"></script>', {
          headers: {'content-type': 'text/html'}
        })
      if (pathname === '/page.js') return new Response(await bundle('page'))
      if (pathname === '/worker.js') return new Response(await bundle('worker'))
      if (pathname === '/change') {
        const count = Number(new URL(request.url).searchParams.get('count'))
        const changed = await change(source, count)
        await server.syncWith(source)
        return new Response(changed)
      }
      const action = new URL(request.url).searchParams.get('action') ?? '?'
      const start = performance.now()
      await sleep(overhead)
      const response = await handler(request, {
        isDev: false,
        handlerUrl: new URL(request.url),
        apiKey: 'bench'
      })
      const stat = requests.get(action) ?? {count: 0, ms: 0}
      stat.count++
      stat.ms += performance.now() - start
      requests.set(action, stat)
      if (!bandwidth || !response.body) return response
      return new Response(response.body.pipeThrough(throttle()), response)
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

  if (browser) {
    const {chromium} = await import('playwright')
    const instance = await chromium.launch()
    try {
      const tab = await instance.newPage()
      await tab.goto(`http://localhost:${http.port}/`)
      await tab.waitForFunction(() => 'bench' in window)
      const phase = async (title: string, phase: Phase) => {
        const rows = await tab.evaluate(phase => window.bench(phase), phase)
        table(title, rows)
        return rows
      }
      const [, initial] = await phase('initial sync', 'initial')
      await phase('reload (next page load)', 'reload')
      await phase('incremental syncs', 'incremental')
      await phase('reload over the deltas', 'reload')
      const [reindex] = await phase('another config', 'reindex')
      console.log(
        `\nreindex ${fixed(reindex.ms)} ms vs initial sync ${fixed(initial.ms)} ms`
      )
    } finally {
      await instance.close()
    }
  } else {
    console.log('phases')
    await time('tree request', () =>
      client.getTreeIfDifferent(ReadonlyTree.EMPTY.sha)
    )
    await time('blobs: one request, decoded', () =>
      accumulate(client.getBlobs(shas))
    )
    for (const n of [2, 4, 8])
      await time(`blobs: ${n} parallel requests, decoded`, () =>
        Promise.all(
          Array.from({length: n}, (_, i) =>
            accumulate(
              client.getBlobs(
                shas.slice(
                  Math.floor((i * shas.length) / n),
                  Math.floor(((i + 1) * shas.length) / n)
                )
              )
            )
          )
        )
      )
    await time('blobs: 250 per request, 5 in flight (as before)', async () => {
      const batches = Array.from(chunks(shas, 250))
      async function worker() {
        for (let batch; (batch = batches.shift());)
          await accumulate(client.getBlobs(batch))
      }
      await Promise.all(Array.from({length: 5}, worker))
    })
    await time('blobs: server reads them from its database', () =>
      accumulate(server.source.getBlobs(shas))
    )
    const encoded = new Uint8Array(
      await new Response(
        encodeBlobSequence(source.getBlobs(shas))
      ).arrayBuffer()
    )
    await time('blobs: encode as CBOR sequence', () =>
      new Response(encodeBlobSequence(source.getBlobs(shas))).arrayBuffer()
    )
    await time('blobs: gzip the encoded sequence', () =>
      new Response(
        new Blob([encoded]).stream().pipeThrough(new CompressionStream('gzip'))
      ).arrayBuffer()
    )
    await time('blobs: decode the CBOR sequence', () =>
      accumulate(decodeBlobSequence(new Blob([encoded]).stream()))
    )
    await time('index from memory (parse, insert, derive)', async () => {
      const {store} = await browserStore()
      await store.syncWith(source, {validate: false})
      await store.close()
    })

    console.log('\nend to end')
    requests.clear()
    const {store, handle} = await browserStore()
    await time('initial sync over HTTP', () =>
      store.syncWith(client, {validate: false})
    )
    for (const [action, {count, ms}] of requests)
      console.log(
        `  ${action.padEnd(8)} ${String(count).padStart(4)} requests, ${ms.toFixed(0)} ms in handler`
      )
    console.log(`  ${await store.count({status: 'all'})} entries indexed`)
    const stored = handle.export().length / 1024 / 1024
    console.log(`  ${stored.toFixed(1)} MB database to store`)
    await store.close()
  }
  http.stop(true)
  await server.close()
} finally {
  await rm(dir, {recursive: true, force: true})
}
