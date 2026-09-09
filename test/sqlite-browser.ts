/** Run explicitly with `bun test/sqlite-browser.ts`; requires installed Chromium. */
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {createFrameKey, encryptFrame} from '#/database/replica/Frame.js'
import {packFrames} from '#/database/replica/Transport.js'
import {entryVersionId} from '#/database/entry/Schema.js'
import {replicaIdentity} from './sqlite-browser/config.js'

const frames = await Promise.all(
  ['a', 'b'].map(async id => {
    const key = createFrameKey()
    const frame = await encryptFrame(
      {
        ...replicaIdentity,
        versionId: entryVersionId(id, null, 'published'),
        payloadId: id,
        kind: 'data'
      },
      new TextEncoder().encode(
        JSON.stringify({data: {title: `Payload ${id}`}})
      ),
      key
    )
    return {...frame, key}
  })
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
  entrypoints: ['test/sqlite-browser/main.ts', 'test/sqlite-browser/worker.ts'],
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
    else if (path === '/grants') {
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
  console.log(
    'Chromium SQLite worker: encrypted range hydration, ciphertext reuse after restart, Graph queries and live subscriptions passed'
  )
} finally {
  await browser.close()
}
