import type {LocalConnection} from '#/core/Connection.js'
import type {PreviewMetadata} from '#/core/Preview.js'
import {atom} from 'jotai'

const previewTokens = new WeakMap<
  LocalConnection,
  Promise<string | undefined>
>()

export function getPreviewToken(client: LocalConnection) {
  const current = previewTokens.get(client)
  if (current) return current
  const request =
    typeof client.previewToken === 'function'
      ? client.previewToken()
      : Promise.resolve(undefined)
  const token = request.catch(error => {
    if (previewTokens.get(client) === token) previewTokens.delete(client)
    throw error
  })
  previewTokens.set(client, token)
  return token
}

export function retryPreviewToken(client: LocalConnection) {
  previewTokens.delete(client)
}

export const previewMetadataAtom = atom<PreviewMetadata | undefined>(undefined)
