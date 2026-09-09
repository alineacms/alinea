/** Run explicitly with `bun test/sqlite-browser.ts`; requires installed Chromium. */
import assert from 'node:assert/strict'
import {chromium} from 'playwright'

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
          new URL(output.path, 'http://alinea.test/').pathname,
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
  await page.route('http://alinea.test/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/')
      await route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>SQLite worker test</title>'
      })
    else {
      const body = assets.get(path)
      if (body === undefined) throw new Error(`Missing fixture asset ${path}`)
      await route.fulfill({contentType: 'text/javascript', body})
    }
  })
  await page.goto('http://alinea.test/')
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
  console.log(
    'Chromium SQLite worker: Graph scope, lazy hydration, cache, live queries, errors and disposal passed'
  )
} finally {
  await browser.close()
}
