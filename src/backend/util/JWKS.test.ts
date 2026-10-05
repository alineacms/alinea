import {suite} from '@alinea/suite'
import {jwks} from './JWKS.js'

const test = suite(import.meta)

// The cache is shared by the module, so every test uses its own uri
function serve(keys: Array<string>) {
  const originalFetch = globalThis.fetch
  const originalNow = Date.now
  const served = {requests: 0, keys, status: 200, now: originalNow()}
  globalThis.fetch = Object.assign(
    async () => {
      served.requests++
      if (served.status !== 200) return new Response(null, {status: 503})
      return Response.json({keys: served.keys.map(kid => ({kid}))})
    },
    {preconnect: originalFetch.preconnect}
  )
  Date.now = () => served.now
  return Object.assign(served, {
    [Symbol.dispose]() {
      globalThis.fetch = originalFetch
      Date.now = originalNow
    }
  })
}

const kids = (keys: Array<{kid: string}>) => keys.map(key => key.kid)

test('caches keys across calls', async () => {
  using served = serve(['a'])
  const uri = 'https://example.com/cached/jwks.json'
  await Promise.all([jwks(uri, 'a'), jwks(uri, 'b'), jwks(uri, 'c')])
  await jwks(uri)
  test.is(served.requests, 1)
})

test('refetches for an unknown key id at most once a minute', async () => {
  using served = serve(['a'])
  const uri = 'https://example.com/rotated/jwks.json'
  await jwks(uri, 'a')
  served.keys = ['a', 'b']
  test.equal(kids(await jwks(uri, 'b')), ['a'])
  served.now += 61_000
  test.equal(kids(await jwks(uri, 'b')), ['a', 'b'])
  await jwks(uri, 'c')
  test.is(served.requests, 2)
})

test('keeps its keys when a refresh fails', async () => {
  using served = serve(['a'])
  const uri = 'https://example.com/failing/jwks.json'
  await jwks(uri, 'a')
  served.status = 503
  served.now += 11 * 60_000
  await test.throws(() => jwks(uri, 'a'))
  test.equal(kids(await jwks(uri, 'a')), ['a'])
  test.is(served.requests, 2)
})

test('loads again after a failed load', async () => {
  using served = serve(['a'])
  const uri = 'https://example.com/unavailable/jwks.json'
  served.status = 503
  await test.throws(() => jwks(uri, 'a'))
  served.status = 200
  test.equal(kids(await jwks(uri, 'a')), ['a'])
})
