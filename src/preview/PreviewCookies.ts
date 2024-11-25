import {chunkCookieValue, parseChunkedCookies} from './ChunkCookieValue.js'

export const PREVIEW_COOKIE_NAME = '@a/p'
const MAX_CHUNKS = 4

export async function setPreviewCookies(
  payload: string,
  expiresIn = 10_000
): Promise<boolean> {
  const chunks = chunkCookieValue(PREVIEW_COOKIE_NAME, payload)
  if (chunks.length > MAX_CHUNKS) return false
  try {
    const expiry = new Date(Date.now() + expiresIn)
    for (const {name, value} of chunks)
      document.cookie = `${name}=${value};expires=${expiry.toUTCString()}`
    return true
  } catch {
    return false
  }
}

export function getPreviewPayloadFromCookies(
  allCookies: Array<{name: string; value: string}>
) {
  return parseChunkedCookies(PREVIEW_COOKIE_NAME, allCookies)
}
