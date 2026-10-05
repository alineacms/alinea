import {createConfig} from '#/core/Config.js'
import {suite} from '@alinea/suite'
import {OAuth2} from './OAuth2.js'

const test = suite(import.meta)

test('keeps the refresh token while signing keys are unavailable', async () => {
  const originalFetch = globalThis.fetch
  const requested: Array<string> = []
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL) => {
      requested.push(String(input instanceof Request ? input.url : input))
      return new Response(null, {status: 503})
    },
    {preconnect: originalFetch.preconnect}
  )
  const auth = new OAuth2(
    {
      apiKey: 'key',
      handlerUrl: new URL('https://cms.example.com/api'),
      isDev: false
    },
    createConfig({schema: {}, workspaces: {}}),
    {
      clientId: 'client',
      jwksUri: 'https://auth.example.com/unavailable/jwks.json',
      tokenEndpoint: 'https://auth.example.com/token',
      authorizationEndpoint: 'https://auth.example.com/authorize',
      validateClaims() {}
    }
  )
  // A token with a key id, its signature is never checked
  const token = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImEifQ.e30.'
  try {
    await test.throws(
      () =>
        auth.verify(
          new Request('https://cms.example.com/api', {
            headers: {cookie: `alinea.at=${token}; alinea.rt=refresh`}
          })
        ),
      'Remote unavailable'
    )
    test.equal(requested, ['https://auth.example.com/unavailable/jwks.json'])
  } finally {
    globalThis.fetch = originalFetch
  }
})
