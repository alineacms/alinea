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
 * With --browser it syncs a browser store kept in IndexedDB in Chromium, and
 * reopens it as a next load and as another dashboard build would. --profile
 * lists the functions the browser spent the most time in.
 *
 *   bun test/bench/initial-sync.ts [files] [overhead ms] [bandwidth MB/s]
 *     [--browser] [--profile]
 */
import {MissingCredentialsError} from '#/backend/Auth.js'
import {createHandler} from '#/backend/Handler.js'
import {createGeneratedDatabase} from '#/backend/store/GeneratedDatabase.js'
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

const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'))
const browser = process.argv.includes('--browser')
const profile = process.argv.includes('--profile')
const size = Number(args[0] ?? 20_000)
const overhead = Number(args[1] ?? 0)
const bandwidth = Number(args[2] ?? 0) * 1024 * 1024

const {config} = cms

/** The generated site as a source. */
async function generate() {
  const source = new MemorySource()
  const changes = await Promise.all(
    content(size).map(async file => ({
      op: 'add' as const,
      path: file.path,
      sha: await hashBlob(file.contents),
      contents: file.contents
    }))
  )
  await source.applyChanges({fromSha: ReadonlyTree.EMPTY.sha, changes})
  return source
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

interface ProfileNode {
  id: number
  callFrame: {functionName: string; url: string; lineNumber: number}
}

/** Print the functions the browser spent the most time in themselves. */
function printProfile(result: {
  nodes: Array<ProfileNode>
  samples?: Array<number>
  timeDeltas?: Array<number>
}) {
  const nodes = new Map(result.nodes.map(node => [node.id, node]))
  const self = new Map<string, number>()
  const {samples = [], timeDeltas = []} = result
  for (const [i, id] of samples.entries()) {
    const {functionName, url, lineNumber} = nodes.get(id)!.callFrame
    const name = `${functionName || '(anonymous)'} ${url.split('/').pop()}:${lineNumber}`
    self.set(name, (self.get(name) ?? 0) + (timeDeltas[i] ?? 0) / 1000)
  }
  const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 30)
  console.log('\nself time')
  for (const [name, ms] of top)
    console.log(
      `${name.slice(0, 64).padEnd(66)} ${ms.toFixed(0).padStart(6)} ms`
    )
}

let built: Promise<Blob> | undefined
function page() {
  return (built ??= Bun.build({
    entrypoints: [join(import.meta.dir, 'initial-sync.page.ts')],
    target: 'browser',
    define: {'process.env.NODE_ENV': '"production"'}
  }).then(result => {
    if (!result.success) throw new AggregateError(result.logs)
    return result.outputs[0]
  }))
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
      if (pathname === '/page.js') return new Response(await page())
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
      requests.clear()
      const cdp = profile ? await tab.context().newCDPSession(tab) : undefined
      await cdp?.send('Profiler.enable')
      await cdp?.send('Profiler.setSamplingInterval', {interval: 200})
      await cdp?.send('Profiler.start')
      const result = await tab.evaluate(() => window.bench())
      if (cdp) printProfile((await cdp.send('Profiler.stop')).profile)
      console.log(`browser (${result.count} entries indexed)`)
      for (const [label, ms] of Object.entries(result.timings))
        console.log(`${label.padEnd(52)} ${String(ms).padStart(6)} ms`)
      console.log(`requests: ${result.requests.join(', ')}`)
      console.log(
        `IndexedDB: ${result.idb.puts} puts, ${(result.idb.bytes / 1024 / 1024).toFixed(1)} MB, transactions ${result.idb.transactions.join(' ')} ms`
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
