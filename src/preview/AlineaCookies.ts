import {chunkCookieValue} from '../preview/ChunkCookieValue.js'

export const alineaCookies = {
  update: '@a/u',
  previewToken: '@a/p'
}

const MAX_CHUNKS = 4

export function setPreviewCookies(update: string): boolean {
  const chunks = chunkCookieValue(alineaCookies.update, update)
  if (chunks.length > MAX_CHUNKS) return false
  try {
    const expiry = new Date(Date.now() + 10_000)
    for (const {name, value} of chunks)
      document.cookie = `${name}=${value};expires=${expiry.toUTCString()}`
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}
