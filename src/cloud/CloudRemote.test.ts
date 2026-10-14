import {createHandler} from '#/backend/Handler.js'
import {createCMS} from '#/core.js'
import {createConfig} from '#/core/Config.js'
import type {RequestContext} from '#/core/Connection.js'
import type {HttpError} from '#/core/HttpError.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config} from '#/index.js'
import {suite} from '@alinea/suite'
import {jest} from 'bun:test'
import {CloudRemote} from './CloudRemote.js'

const test = suite(import.meta)

test('returns safe handshake validation details', async () => {
  const context: RequestContext = {
    apiKey: 'alineapk_client-id_secret',
    handlerUrl: new URL('https://cms.example.com/api'),
    isDev: false
  }
  const config = createConfig({schema: {}, workspaces: {}})
  const remote = new CloudRemote(context, config)
  const request = new Request(
    'https://cms.example.com/api?auth=handshake&handshake_id=handshake-id&handshake_token=bnVsbA.e30.'
  )

  await test.throws(
    () =>
      remote.authenticate(request, {
        async authenticated(user) {
          return {user, capabilities: {users: false}}
        }
      }),
    'Invalid handshake token: Handshake token header is invalid'
  )
})

test('returns handshake signing key failures as unavailable', async () => {
  const originalFetch = globalThis.fetch
  const originalNow = Date.now
  const now = originalNow()
  // Keys cached by other tests have expired by then
  Date.now = () => now + 60 * 60_000
  globalThis.fetch = Object.assign(
    async () => new Response('Unavailable', {status: 503}),
    {preconnect: originalFetch.preconnect}
  )
  const context: RequestContext = {
    apiKey: 'alineapk_client-id_secret',
    handlerUrl: new URL('https://cms.example.com/api'),
    isDev: false
  }
  const cms = createCMS({schema: {}, workspaces: {}})
  const remote = new CloudRemote(context, cms.config)
  const handle = createHandler({
    cms,
    db: new LocalDB(cms.config),
    remote: () => remote
  })
  const request = new Request(
    'https://cms.example.com/api?auth=handshake&handshake_id=handshake-id&handshake_token=eyJhbGciOiJSUzI1NiIsImtpZCI6Im1pc3NpbmcifQ.e30.'
  )

  try {
    const response = await handle(request, context)
    test.is(response.status, 503)
    test.equal(await response.json(), {
      success: false,
      error: 'Could not load handshake signing keys: 503'
    })
  } finally {
    globalThis.fetch = originalFetch
    Date.now = originalNow
  }
})

test('serves bundled content without asking the cloud when no api key is set', async () => {
  const context: RequestContext = {
    apiKey: 'generated-release-id',
    handlerUrl: new URL('https://cms.example.com/api'),
    isDev: false
  }
  const config = createConfig({schema: {}, workspaces: {}})
  const remote = new CloudRemote(context, config)
  const originalFetch = globalThis.fetch
  let requests = 0
  globalThis.fetch = (async () => {
    requests++
    return new Response(null, {status: 500})
  }) as unknown as typeof fetch
  try {
    test.is(
      await remote.getTreeIfDifferent(
        '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
      ),
      undefined
    )
    test.is(requests, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('gives up on reads the cloud does not answer', async () => {
  const context: RequestContext = {
    apiKey: 'alineapk_client-id_secret',
    handlerUrl: new URL('https://cms.example.com/api'),
    isDev: false
  }
  const config = createConfig({
    schema: {},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {pages: Config.root('Pages')}
      })
    }
  })
  const remote = new CloudRemote(context, config)
  const originalFetch = globalThis.fetch
  globalThis.fetch = ((_: string, init: RequestInit) =>
    new Promise((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(init.signal!.reason))
    })) as unknown as typeof fetch
  jest.useFakeTimers()
  try {
    const failed = remote
      .getTreeIfDifferent('sha')
      .catch((error: HttpError) => error)
    jest.advanceTimersByTime(30_000)
    test.is(((await failed) as HttpError).code, 504)
  } finally {
    jest.useRealTimers()
    globalThis.fetch = originalFetch
  }
})
