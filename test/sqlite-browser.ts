/** Run explicitly with `bun test/sqlite-browser.ts`; requires installed Chromium. */
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {role} from '#/core/Role.js'
import {EntryRuntime} from '#/database/runtime/EntryRuntime.js'
import {FrameStore, buildFrames} from '#/database/release/FrameStore.js'
import {GrantService} from '#/database/handler/Grants.js'
import {authorizedIndex} from '#/database/handler/Policy.js'
import {packFrames} from '#/database/replica/Transport.js'
import {entryVersionId} from '#/database/entry/Schema.js'
import {config, entry, replicaIdentity} from './sqlite-browser/config.js'
import {base64} from '#/core/util/Encoding.js'
import type {PayloadBatchRequest} from '#/database/replica/PayloadBatch.js'

using sqlite = new Database(':memory:')
const db = connect(sqlite)
await EntryRuntime.createSchema(db, 'empty')
const runtime = new EntryRuntime(
  {
    ...config,
    roles: {
      reader: role('Reader', {
        permissions(policy) {
          policy.allowAll()
        }
      })
    }
  },
  db
)
await runtime.apply({
  fromRevision: 'empty',
  toRevision: 'r1',
  entries: ['a', 'b'].map(id => ({
    entry: entry(id),
    payloadId: id,
    data: {title: `Payload ${id}`}
  }))
})
await buildFrames(db, replicaIdentity)
const store = new FrameStore(db)
const service = new GrantService(runtime, store, replicaIdentity)
const view = await authorizedIndex(runtime, ['reader'])
const issued = await service.issue(
  ['reader'],
  view,
  ['a', 'b'].map(id => ({
    versionId: entryVersionId(id, null, 'published'),
    payloadId: id
  }))
)
const frames = await Promise.all(
  issued.map(async grant => ({
    ...grant,
    ciphertext: await store.ciphertext(grant.descriptor)
  }))
)
const bundle = packFrames(frames)
const grants = bundle.locations.map((location, i) => ({
  ...location,
  url: 'https://alinea.test/bundle.bin',
  key: Array.from(frames[i].key),
  descriptor: {
    ...location.descriptor,
    nonce: Array.from(location.descriptor.nonce)
  }
}))
const ranges: Array<string> = []

const build = await Bun.build({
  entrypoints: [
    'test/sqlite-browser/main.ts',
    'test/sqlite-browser/worker.ts',
    'test/sqlite-browser/owned-worker.ts'
  ],
  target: 'browser',
  format: 'esm',
  conditions: ['alinea-src', 'browser'],
  naming: '[name].js'
})
if (!build.success)
  throw new AggregateError(build.logs, 'Browser fixture build failed')
const assets = new Map(
  await Promise.all(
    build.outputs.map(
      async output =>
        [
          new URL(output.path, 'https://alinea.test/').pathname,
          await output.text()
        ] as const
    )
  )
)
const browser = await chromium.launch({headless: true})
try {
  const page = await browser.newPage()
  page.on('console', message => console.log(message.text()))
  page.on('pageerror', error => console.error(error))
  await page.context().route('https://alinea.test/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/')
      await route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>SQLite worker test</title>'
      })
    else if (path === '/replica' || path === '/advance') {
      assert.equal(route.request().headers().authorization, 'Bearer fixture')
      assert.equal(route.request().method(), 'POST')
      if (path === '/advance') {
        await runtime.apply({
          fromRevision: 'r1',
          toRevision: 'r2',
          entries: [{entry: entry('a', 'Updated a'), payloadId: 'a'}]
        })
        await route.fulfill({status: 204})
      } else {
        const view = await authorizedIndex(runtime, ['reader'])
        const identity = {...replicaIdentity, viewId: view.viewId}
        const action = new URL(route.request().url()).searchParams.get('action')
        if (action === 'replicaIndex') {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({version: 1, identity, ...view})
          })
        } else {
          assert.equal(action, 'replicaPayloads')
          const request = route.request().postDataJSON() as PayloadBatchRequest
          assert.deepEqual(request.identity, identity)
          const grants = await service.issue(
            ['reader'],
            {revision: request.revision, viewId: request.identity.viewId},
            request.requests
          )
          const frames = await Promise.all(
            grants.map(async ({descriptor, key}) => ({
              descriptor: {
                ...descriptor,
                nonce: base64.stringify(descriptor.nonce)
              },
              key: base64.stringify(key),
              ciphertext: base64.stringify(await store.ciphertext(descriptor))
            }))
          )
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              version: 1,
              identity,
              revision: view.revision,
              frames
            })
          })
        }
      }
    } else if (path === '/grants') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(grants)
      })
    } else if (path === '/bundle.bin') {
      const range = route.request().headers().range
      const match = /^bytes=(\d+)-(\d+)$/.exec(range ?? '')
      assert.ok(match)
      ranges.push(range)
      const start = Number(match[1]),
        end = Number(match[2])
      assert.ok(start >= 0 && end < bundle.contents.length)
      await route.fulfill({
        status: 206,
        contentType: 'application/octet-stream',
        headers: {
          'content-range': `bytes ${start}-${end}/${bundle.contents.length}`
        },
        body: Buffer.from(bundle.contents.slice(start, end + 1))
      })
    } else {
      const body = assets.get(path)
      if (body === undefined) throw new Error(`Missing fixture asset ${path}`)
      await route.fulfill({contentType: 'text/javascript', body})
    }
  })
  await page.goto('https://alinea.test/')
  const result = await page.evaluate(async path => {
    const {run} = await import(path)
    return Promise.race([
      run(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Worker test timed out')), 15000)
      )
    ])
  }, '/main.js')
  assert.deepEqual(result, {loads: ['a'], deliveries: 2, closed: true})
  assert.deepEqual(ranges, [`bytes=0-${frames[0].ciphertext.length - 1}`])
  const owned = await page.evaluate(async path => {
    const {runOwned} = await import(path)
    return Promise.race([
      runOwned(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Owned worker timed out')), 15000)
      )
    ])
  }, '/main.js')
  assert.deepEqual(owned, {deliveries: 2, closed: true})
  console.log(
    'Chromium SQLite workers: encrypted range hydration, authenticated bootstrap, live refresh, Graph queries and logout purge passed'
  )
} finally {
  await browser.close()
}
