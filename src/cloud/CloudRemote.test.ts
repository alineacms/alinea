import {createHandler} from '#/backend/Handler.js'
import {createCMS} from '#/core.js'
import {createConfig} from '#/core/Config.js'
import type {RequestContext} from '#/core/Connection.js'
import {LocalDB} from '#/database/LocalDB.js'
import {suite} from '@alinea/suite'
import {CloudRemote} from './CloudRemote.js'

const test = suite(import.meta)

test('does not expose unsupported user management', async () => {
  const context: RequestContext = {
    apiKey: 'project_test',
    handlerUrl: new URL('https://cms.example.com/api'),
    isDev: false
  }
  const config = createConfig({schema: {}, workspaces: {}})
  const remote = new CloudRemote(context, config)

  test.equal(await remote.capabilities(), {users: false})
})

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
  }
})
