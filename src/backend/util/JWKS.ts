import {HttpError} from '#/core/HttpError.js'
import {isRecord} from '#/core/util/Objects.js'

export interface WebKey extends JsonWebKey {
  kid: string
}

interface Cached {
  keys: Promise<Array<WebKey>>
  expires: number
  loaded: number
}

// Keys are kept for 10 minutes, so a key the provider drops is trusted that
// long at most. A token signed with a key we don't know yet refetches early,
// but at most once a minute so random key ids can't hammer the provider.
const lifetime = 10 * 60 * 1000
const refreshInterval = 60 * 1000
const cache = new Map<string, Cached>()

export async function jwks(uri: string, kid?: string): Promise<Array<WebKey>> {
  const cached = cache.get(uri)
  if (!cached || Date.now() >= cached.expires) return load(uri, cached)
  const keys = await cached.keys
  if (!kid || keys.some(key => key.kid === kid)) return keys
  const current = cache.get(uri)
  // Another request refreshed them while we waited
  if (current && current !== cached) return current.keys
  if (Date.now() - cached.loaded < refreshInterval) return keys
  return load(uri, cached)
}

function load(uri: string, previous?: Cached): Promise<Array<WebKey>> {
  const fetched = fetch(uri).then(async response => {
    if (!response.ok) throw new HttpError(response.status)
    const body: unknown = await response.json()
    if (!isRecord(body) || !Array.isArray(body.keys))
      throw new Error('Invalid signing keys')
    return body.keys.filter(isKey)
  })
  // Failing to refresh keeps the keys we had
  const keys = previous ? fetched.catch(() => previous.keys) : fetched
  const entry = {keys, expires: Date.now() + lifetime, loaded: Date.now()}
  cache.set(uri, entry)
  keys.catch(() => {
    if (cache.get(uri) === entry) cache.delete(uri)
  })
  return keys
}

function isKey(value: unknown): value is WebKey {
  return isRecord(value) && typeof value.kid === 'string'
}
