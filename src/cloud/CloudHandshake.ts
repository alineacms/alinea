import {decode, verify} from '#/core/util/JWT.js'
import {isRecord} from '#/core/util/Objects.js'
import {cloudConfig} from './CloudConfig.js'

interface CloudKey extends JsonWebKey {
  kid: string
}

interface VerifyCloudHandshakeOptions {
  clientId: string
  handshakeId: string
  origin: string
}

export class CloudHandshakeError extends Error {
  name = 'CloudHandshakeError'
}

export class CloudHandshakeServiceError extends Error {
  name = 'CloudHandshakeServiceError'
}

let keysPromise: Promise<Array<CloudKey>> | undefined
let keysExpireAt = 0
let lastForcedRefreshAt = 0

const keyCacheLifetime = 5 * 60 * 1000
const forcedRefreshInterval = 60 * 1000
const verificationMessages: Record<string, string> = {
  'Invalid signature': 'Handshake token signature is invalid',
  'Token expired': 'Handshake token has expired',
  'Token not yet valid': 'Handshake token is not yet valid',
  'Invalid exp value': 'Handshake token expiration is invalid',
  'Invalid nbf value': 'Handshake token not-before claim is invalid'
}

export async function verifyCloudHandshake(
  token: string,
  options: VerifyCloudHandshakeOptions
): Promise<void> {
  const {header} = decodeHandshakeToken(token)
  if (
    !isRecord(header) ||
    header.alg !== 'RS256' ||
    typeof header.kid !== 'string' ||
    !header.kid
  )
    throw new CloudHandshakeError('Handshake token header is invalid')
  let key = (await cloudKeys()).find(key => key.kid === header.kid)
  if (!key) {
    key = (await refreshCloudKeys()).find(key => key.kid === header.kid)
  }
  if (!key)
    throw new CloudHandshakeError('Handshake token signing key is unknown')
  const payload = await verify(token, key, {algorithms: ['RS256']}).catch(
    cause => {
      throw verificationError(cause)
    }
  )
  if (!isRecord(payload))
    throw new CloudHandshakeError('Handshake token payload is invalid')
  assertClaim('purpose', payload.purpose, 'handshake')
  assertClaim('ID', payload.handshake_id, options.handshakeId)
  assertClaim('audience', payload.aud, options.clientId)
  assertClaim('issuer', payload.iss, normalizedCloudUrl())
  assertClaim('origin', payload.origin, options.origin)
  if (typeof payload.project !== 'string')
    throw new CloudHandshakeError('Handshake project claim is invalid')
  if (typeof payload.iat !== 'number')
    throw new CloudHandshakeError('Handshake issued-at claim is invalid')
  if (typeof payload.exp !== 'number')
    throw new CloudHandshakeError('Handshake expiration claim is invalid')
}

function assertClaim(name: string, received: unknown, expected: string): void {
  if (received !== expected)
    throw new CloudHandshakeError(
      `Handshake ${name} mismatch: expected ${expected}, received ${String(received)}`
    )
}

function decodeHandshakeToken(token: string): ReturnType<typeof decode> {
  try {
    return decode(token)
  } catch (cause) {
    throw new CloudHandshakeError('Handshake token is malformed', {cause})
  }
}

function verificationError(
  cause: unknown
): CloudHandshakeError | CloudHandshakeServiceError {
  const reason = cause instanceof Error && verificationMessages[cause.message]
  return reason
    ? new CloudHandshakeError(reason, {cause})
    : new CloudHandshakeServiceError('Could not verify handshake token', {
        cause
      })
}

function cloudKeys(): Promise<Array<CloudKey>> {
  if (keysPromise && (keysExpireAt === 0 || Date.now() < keysExpireAt))
    return keysPromise
  return loadCloudKeys()
}

function refreshCloudKeys(): Promise<Array<CloudKey>> {
  const now = Date.now()
  if (keysPromise && keysExpireAt === 0) return keysPromise
  if (keysPromise && now - lastForcedRefreshAt < forcedRefreshInterval)
    return keysPromise
  lastForcedRefreshAt = now
  return loadCloudKeys()
}

function loadCloudKeys(): Promise<Array<CloudKey>> {
  keysExpireAt = 0
  keysPromise = fetch(cloudConfig.jwks)
    .then(async response => {
      if (!response.ok)
        throw new CloudHandshakeServiceError(
          `Could not load handshake signing keys: ${response.status}`
        )
      const body: unknown = await response.json()
      if (!isRecord(body) || !Array.isArray(body.keys))
        throw new CloudHandshakeServiceError(
          'Cloud returned invalid handshake signing keys'
        )
      keysExpireAt = Date.now() + keyCacheLifetime
      return body.keys.filter(isCloudKey)
    })
    .catch(cause => {
      keysPromise = undefined
      keysExpireAt = 0
      if (cause instanceof CloudHandshakeServiceError) throw cause
      throw new CloudHandshakeServiceError(
        'Could not load handshake signing keys',
        {cause}
      )
    })
  return keysPromise
}

function isCloudKey(value: unknown): value is CloudKey {
  return isRecord(value) && typeof value.kid === 'string'
}

function normalizedCloudUrl(): string {
  return cloudConfig.url.replace(/\/$/, '')
}
