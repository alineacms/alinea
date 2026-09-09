import {sign} from '#/core/util/JWT.js'
import {suite} from '@alinea/suite'
import {crypto} from '@alinea/iso'
import {verifyCloudHandshake} from './CloudHandshake.js'

const test = suite(import.meta)

test('verifies project and origin-bound Cloud handshake tokens', async () => {
  const originalFetch = globalThis.fetch
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1])
    },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair
  const privateKey = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const issuedAt = Math.floor(Date.now() / 1000)
  const token = await sign(
    {
      purpose: 'handshake',
      handshake_id: 'handshake-id',
      project: 'project-id',
      origin: 'https://cms.example.com',
      aud: 'client-id',
      iss: 'https://www.alinea.cloud',
      iat: issuedAt,
      exp: issuedAt + 60
    },
    privateKey,
    {
      algorithm: 'RS256',
      header: {typ: 'JWT', alg: 'RS256', kid: 'test-key'}
    }
  )
  globalThis.fetch = Object.assign(
    async () => Response.json({keys: [{...publicKey, kid: 'test-key'}]}),
    {preconnect: originalFetch.preconnect}
  )
  try {
    await verifyCloudHandshake(token, {
      clientId: 'client-id',
      handshakeId: 'handshake-id',
      origin: 'https://cms.example.com'
    })
    await test.throws(() =>
      verifyCloudHandshake(token, {
        clientId: 'client-id',
        handshakeId: 'handshake-id',
        origin: 'https://attacker.example.com'
      })
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
