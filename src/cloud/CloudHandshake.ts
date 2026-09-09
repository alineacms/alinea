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

let keysPromise: Promise<Array<CloudKey>> | undefined
let keysExpireAt = 0
let lastForcedRefreshAt = 0

const keyCacheLifetime = 5 * 60 * 1000
const forcedRefreshInterval = 60 * 1000

export async function verifyCloudHandshake(
  token: string,
  options: VerifyCloudHandshakeOptions
): Promise<void> {
  const {header} = decode(token)
  if (header.alg !== 'RS256' || typeof header.kid !== 'string')
    throw new Error('Invalid handshake token header')
  let key = (await cloudKeys()).find(key => key.kid === header.kid)
  if (!key) {
    key = (await refreshCloudKeys()).find(key => key.kid === header.kid)
  }
  if (!key) throw new Error('Unknown handshake signing key')
  const payload = await verify(token, key, {algorithms: ['RS256']})
  if (
    !isRecord(payload) ||
    payload.purpose !== 'handshake' ||
    payload.handshake_id !== options.handshakeId ||
    payload.aud !== options.clientId ||
    payload.iss !== normalizedCloudUrl() ||
    payload.origin !== options.origin ||
    typeof payload.project !== 'string' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number'
  ) {
    throw new Error('Invalid handshake token claims')
  }
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
        throw new Error(`Could not load handshake keys: ${response.status}`)
      const body: unknown = await response.json()
      if (!isRecord(body) || !Array.isArray(body.keys))
        throw new Error('Invalid handshake key response')
      keysExpireAt = Date.now() + keyCacheLifetime
      return body.keys.filter(isCloudKey)
    })
    .catch(cause => {
      keysPromise = undefined
      keysExpireAt = 0
      throw cause
    })
  return keysPromise
}

function isCloudKey(value: unknown): value is CloudKey {
  return isRecord(value) && typeof value.kid === 'string'
}

function normalizedCloudUrl(): string {
  return cloudConfig.url.replace(/\/$/, '')
}
