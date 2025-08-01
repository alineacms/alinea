// Based on: https://github.com/tsndr/cloudflare-worker-jwt/blob/e7964b63c2cb128bb4ef6b267405c27243819540/index.js
// Which seems to be based on https://github.com/pose/webcrypto-jwt/blob/d417595d85d993fe2b15d3730683a3836ef0741b/index.js
// And: https://github.com/auth0/node-jsonwebtoken

import {crypto} from '@alinea/iso'
import {base64, base64url} from './Encoding.js'

const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()

const algorithms = {
  ES256: {name: 'ECDSA', namedCurve: 'P-256', hash: {name: 'SHA-256'}},
  ES384: {name: 'ECDSA', namedCurve: 'P-384', hash: {name: 'SHA-384'}},
  ES512: {name: 'ECDSA', namedCurve: 'P-512', hash: {name: 'SHA-512'}},
  HS256: {name: 'HMAC', hash: {name: 'SHA-256'}},
  HS384: {name: 'HMAC', hash: {name: 'SHA-384'}},
  HS512: {name: 'HMAC', hash: {name: 'SHA-512'}},
  RS256: {name: 'RSASSA-PKCS1-v1_5', hash: {name: 'SHA-256'}},
  RS384: {name: 'RSASSA-PKCS1-v1_5', hash: {name: 'SHA-384'}},
  RS512: {name: 'RSASSA-PKCS1-v1_5', hash: {name: 'SHA-512'}}
}

type Algorithm = keyof typeof algorithms

type JWTHeader = {
  alg: Algorithm
  kid?: string
  typ?: string
  cty?: string
  crit?: string[]
  [key: string]: any
}

type JWTPayload = Record<string, any>

type JWT = {
  header: JWTHeader
  payload: JWTPayload
  signature: Uint8Array
}

function defaultAlgorithms(
  secretOrPublicKey: string | JsonWebKey
): Array<Algorithm> {
  if (typeof secretOrPublicKey === 'string') {
    if (
      secretOrPublicKey.includes('BEGIN CERTIFICATE') ||
      secretOrPublicKey.includes('BEGIN PUBLIC KEY')
    )
      return ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512']
    if (secretOrPublicKey.includes('BEGIN RSA PUBLIC KEY'))
      return ['RS256', 'RS384', 'RS512']
    return ['HS256', 'HS384', 'HS512']
  }
  return ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512']
}

export function importKey(
  secret: string | JsonWebKey,
  algorithm: (typeof algorithms)[Algorithm],
  use: 'sign' | 'verify'
): Promise<CryptoKey> {
  if (typeof secret !== 'string')
    return crypto.subtle.importKey('jwk', secret, algorithm, false, [use])
  if (secret.startsWith('-----BEGIN'))
    return crypto.subtle.importKey(
      'pkcs8',
      base64.parse(
        secret
          .replace(/-----BEGIN.*?-----/g, '')
          .replace(/-----END.*?-----/g, '')
          .replace(/\s/g, '')
      ),
      algorithm,
      false,
      [use]
    )
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    algorithm,
    false,
    [use]
  )
}

/**
 * Options for signing a JWT.
 * @property algorithm - The algorithm to use for signing (e.g., 'HS256').
 * @property header - Optional custom header fields to include in the JWT header.
 */
export type SignOptions = {
  /** The algorithm to use for signing (e.g., 'HS256'). */
  algorithm: Algorithm
  /** Optional custom header fields to include in the JWT header. */
  header?: Record<string, any>
}

/**
 * Signs a JWT payload and returns the token string.
 * @param payload - The payload to include in the JWT.
 * @param secret - The secret or key to sign the JWT with.
 * @param options - Options for signing, including algorithm and header.
 * @returns The signed JWT as a string.
 */
export async function sign(
  payload: JWTPayload,
  secret: string | JsonWebKey,
  options: SignOptions = {algorithm: 'HS256'}
): Promise<string> {
  if (payload === null || typeof payload !== 'object')
    throw new Error('payload must be an object')
  if (typeof options.algorithm !== 'string')
    throw new Error('options.algorithm must be a string')
  const algorithm = algorithms[options.algorithm]
  if (!algorithm) throw new Error('algorithm not found')
  const payloadAsJSON = JSON.stringify(payload)
  const partialToken = `${base64url.stringify(
    textEncoder.encode(
      JSON.stringify(
        options.header || {
          typ: 'JWT',
          alg: options.algorithm
        }
      )
    ),
    {pad: false}
  )}.${base64url.stringify(textEncoder.encode(payloadAsJSON), {pad: false})}`
  const key = await importKey(secret, algorithm, 'sign')
  const signature = await crypto.subtle.sign(
    algorithm,
    key,
    textEncoder.encode(partialToken)
  )
  return [
    partialToken,
    base64url.stringify(new Uint8Array(signature), {
      pad: false
    })
  ].join('.')
}

/**
 * Options for verifying a JWT.
 * @property algorithms - Allowed algorithms for verification.
 * @property clockTolerance - Allowed clock skew in seconds.
 * @property clockTimestamp - Override the current time for verification.
 */
export type VerifyOptions = {
  /** Allowed algorithms for verification. */
  algorithms?: Array<Algorithm>
  /** Allowed clock skew in seconds. */
  clockTolerance?: number
  /** Override the current time for verification. */
  clockTimestamp?: number
}

/**
 * Verifies a JWT token using a secret or public key.
 * @param token - The JWT token string to verify.
 * @param secret - The secret to verify the JWT with.
 * @param options - Verification options.
 * @returns The decoded JWT payload if verification succeeds.
 */
export function verify<T = JWTPayload>(
  token: string,
  secret: string,
  options?: VerifyOptions
): Promise<T>
/**
 * Verifies a JWT token using a public key.
 * @param token - The JWT token string to verify.
 * @param publicKey - The public key to verify the JWT with.
 * @param options - Verification options.
 * @returns The decoded JWT payload if verification succeeds.
 */
export function verify<T = JWTPayload>(
  token: string,
  publicKey: JsonWebKey,
  options?: VerifyOptions
): Promise<T>
/**
 * Verifies a JWT token using a secret or public key.
 * @param token - The JWT token string to verify.
 * @param secretOrPublicKey - The secret or public key to verify the JWT with.
 * @param options - Verification options.
 * @returns The decoded JWT payload if verification succeeds.
 */
export async function verify(
  token: string,
  secretOrPublicKey: string | JsonWebKey,
  options: VerifyOptions = {}
) {
  if (typeof token !== 'string') throw new Error('Token must be string')
  if (
    typeof secretOrPublicKey !== 'string' &&
    typeof secretOrPublicKey !== 'object'
  )
    throw new Error('Invalid secret')
  if (typeof options !== 'object') throw new Error('Options must be object')
  const allowedAlgorithms =
    options.algorithms || defaultAlgorithms(secretOrPublicKey)
  const {header, payload, signature} = decode(token)
  if (!(header.alg in algorithms)) throw new Error('Unsupported algorithm')
  if (!allowedAlgorithms.includes(header.alg))
    throw new Error('Unsupported algorithm')
  const algorithm = algorithms[header.alg]
  const key = await importKey(secretOrPublicKey, algorithm, 'verify')
  const isValid = await crypto.subtle.verify(
    algorithm,
    key,
    signature,
    new TextEncoder().encode(token.slice(0, token.lastIndexOf('.')))
  )
  if (!isValid) throw new Error('Invalid signature')

  const clockTimestamp = options.clockTimestamp || Math.floor(Date.now() / 1000)
  const clockTolerance = options.clockTolerance || 0

  const nbf = payload.nbf
  if (nbf && typeof nbf !== 'number') throw new Error('Invalid nbf value')
  if (payload.nbf > clockTimestamp + clockTolerance)
    throw new Error('Token not yet valid')
  const exp = payload.exp
  if (exp && typeof payload.exp !== 'number')
    throw new Error('Invalid exp value')
  if (clockTimestamp >= payload.exp + clockTolerance)
    throw new Error('Token expired')

  return payload
}

/**
 * Decodes a JWT token into its header, payload, and signature components.
 * @param token - The JWT token string to decode.
 * @returns The decoded JWT object.
 */
export function decode(token: string): JWT {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token')
  const header = JSON.parse(
    textDecoder.decode(base64url.parse(parts[0], {loose: true}))
  )
  const payload = JSON.parse(
    textDecoder.decode(base64url.parse(parts[1], {loose: true}))
  )
  const signature = base64url.parse(parts[2], {loose: true})
  return {header, payload, signature}
}
