/** Run explicitly with `bun test/sqlite-browser.ts`; requires installed Chromium. */
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {role} from '#/core/Role.js'
import {EntryRuntime} from '#/database/runtime/EntryRuntime.js'
import {authorizedIndex} from '#/database/handler/Policy.js'
import {authorizedPayloads} from '#/database/handler/Payloads.js'
import {config, entry, replicaIdentity} from './sqlite-browser/config.js'
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
const view = await authorizedIndex(runtime, ['reader'])

const build = await Bun.build({
  entrypoints: [
    'test/sqlite-browser/main.ts',
    'test/sqlite-browser/worker.ts',
    'test/sqlite-browser/owned-worker.ts',
    'test/sqlite-browser/host-worker.ts'
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
          const payloads = await authorizedPayloads(runtime, ['reader'], request)
          await route.fulfill({
            contentType: 'application/x-alinea-payloads',
            body:
              [
                JSON.stringify({version: 1, identity, revision: view.revision}),
                ...payloads.map(
                  row =>
                    `${JSON.stringify(row.versionId)}\t${JSON.stringify(row.payloadId)}\t${JSON.stringify(row.data)}\t${JSON.stringify(row.source ?? null)}`
                )
              ].join('\n') + '\n'
          })
        }
      }
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
  assert.equal(
    await page.evaluate(async path => {
      const {runPending} = await import(path)
      return runPending()
    }, '/main.js'),
    true
  )
  console.log(
    'Chromium SQLite workers: streamed hydration, authenticated bootstrap, live Graph queries, pending-edit restart and logout purge passed'
  )
  assert.deepEqual(await page.evaluate(async path => {
    const {runHost} = await import(path)
    return Promise.race([runHost(), new Promise((_, reject) => setTimeout(() => reject(new Error('Dashboard worker host timed out')), 15000))])
  }, '/main.js'), {connected: true})
  console.log('Dedicated dashboard replica worker: generated binding, lazy Graph reads and cleanup passed')
  assert.deepEqual(await page.evaluate(async path => {
    const {runHostCrash} = await import(path)
    return Promise.race([runHostCrash(), new Promise((_, reject) => setTimeout(() => reject(new Error('Worker crash cleanup timed out')), 15000))])
  }, '/main.js'), {crashed: true, purged: true})
  console.log('Dedicated worker crash: pending calls rejected, live queries invalidated and old cache generations purged')
} finally {
  await browser.close()
}
