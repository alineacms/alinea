import {createConfig} from '#/core/Config.js'
import {sign} from '#/core/util/JWT.js'
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

test('refreshes once for parallel requests with the same refresh token', async () => {
  const originalFetch = globalThis.fetch
  const {privateKey, publicKey} = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  )
  const jwk = await crypto.subtle.exportKey('jwk', publicKey)
  const signingKey = await crypto.subtle.exportKey('jwk', privateKey)
  const now = Math.floor(Date.now() / 1000)
  const token = (exp: number) =>
    sign({sub: 'ada', exp}, signingKey, {
      algorithm: 'RS256',
      header: {alg: 'RS256', kid: 'key'}
    })
  const expired = await token(now - 60)
  const fresh = await token(now + 3600)
  let refreshes = 0
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url === 'https://auth.example.com/rotating/jwks.json')
        return Response.json({keys: [{...jwk, kid: 'key', alg: 'RS256'}]})
      if (url === 'https://auth.example.com/token') {
        refreshes++
        await new Promise(resolve => setTimeout(resolve, 10))
        return Response.json({
          access_token: fresh,
          refresh_token: 'rotated',
          token_type: 'Bearer',
          expires_in: 3600
        })
      }
      throw new Error(`Unexpected request: ${url}`)
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
      jwksUri: 'https://auth.example.com/rotating/jwks.json',
      tokenEndpoint: 'https://auth.example.com/token',
      authorizationEndpoint: 'https://auth.example.com/authorize',
      validateClaims() {}
    }
  )
  const verify = () =>
    auth
      .verify(
        new Request('https://cms.example.com/api', {
          headers: {cookie: `alinea.at=${expired}; alinea.rt=single-use`}
        })
      )
      .catch(error => error)
  const cookies = (response: Response) => response.headers.get('set-cookie')
  try {
    const responses = await Promise.all([verify(), verify(), verify()])
    // A request sent before the browser stored the new cookies
    const late = await verify()
    test.is(refreshes, 1)
    for (const response of [...responses, late]) {
      test.ok(response instanceof Response)
      test.is(response.status, 401)
      test.ok(cookies(response)?.includes(`alinea.at=${fresh}`))
      test.ok(cookies(response)?.includes('alinea.rt=rotated'))
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})
