import {expect, test} from 'bun:test'
import {FSSource} from '#/core/source/FSSource.js'
import {exportRuntimeDatabase} from '#/database/runtime/Exporter.js'
import {cms} from '#test/cms.js'
import {createGeneratedRuntimeDB} from './RuntimeDB.js'

test('reads a generated payload from its public HTTP URL', async () => {
  const generated = await exportRuntimeDatabase({
    config: cms.config,
    source: new FSSource('test/fixtures/demo'),
    bundleId: 'encrypted-bundle',
    bundleUrl: '/admin/deployment/payload.bundle',
    compression: 'none'
  })
  const requests: Array<{url: string; range: string | null}> = []
  const fetch = (async (input, init) => {
    const range = new Headers(init?.headers).get('range')
    requests.push({url: String(input), range})
    const match = range?.match(/^bytes=(\d+)-(\d+)$/)
    if (!match) return new Response(null, {status: 400})
    const start = Number(match[1])
    const end = Number(match[2])
    return new Response(generated.bundle.slice(start, end + 1), {status: 206})
  }) as typeof globalThis.fetch
  const db = createGeneratedRuntimeDB(cms.config, {
    environment: {
      adminPath: '/admin',
      releaseId: 'deployment',
      configId: 'config',
      releaseUrl: generated.index.bundleUrl,
      configUrl: '/admin/config/config/client-config.js'
    },
    index: generated.index,
    fetch,
    nodeEnv: 'production'
  })

  expect(
    await db.get({
      type: cms.schema.DemoRecipe,
      path: 'chocolate-chip',
      select: cms.schema.DemoRecipe.intro
    })
  ).toEqual(expect.any(Array))
  expect(requests.length).toBeGreaterThan(0)
  expect(requests.every(request => request.range)).toBe(true)
  expect(requests[0].url).toBe(
    'https://alineacms.com/admin/deployment/payload.bundle'
  )
})
