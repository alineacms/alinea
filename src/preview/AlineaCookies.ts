import {chunkCookieValue} from '../preview/ChunkCookieValue.js'

export const alineaCookies = {
  update: '@a/u',
  previewToken: '@a/p'
}

const MAX_CHUNKS = 5

export async function setPreviewCookies(update: string) {
  const chunks = chunkCookieValue(alineaCookies.update, update)

  // Todo: if we reached the limit show the user a modal or indication in
  // the UI that previewing will be temporarily disabled until the changes
  // are saved or published
  if (chunks.length > MAX_CHUNKS) {
    console.warn('Too many chunks, previewing will be disabled')
    return
  }

  const expiry = new Date(Date.now() + 10_000)
  for (const {name, value} of chunks) {
    document.cookie = `${name}=${value};expires=${expiry.toUTCString()}`
  }
}
