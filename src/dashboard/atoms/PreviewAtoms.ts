import type {LocalConnection} from '#/core/Connection.js'
import type {PreviewMetadata} from '#/core/Preview.js'
import {atom} from 'jotai'

export const previewMetadataAtom = atom<PreviewMetadata | undefined>(undefined)

const readyPreviewOriginsAtom = atom<ReadonlySet<string>>(new Set<string>())

export const previewSessionOriginsAtom = atom(get =>
  get(readyPreviewOriginsAtom)
)

export const markPreviewSessionReadyAtom = atom(
  null,
  (get, set, origin: string) => {
    const current = get(readyPreviewOriginsAtom)
    if (current.has(origin)) return
    set(readyPreviewOriginsAtom, new Set(current).add(origin))
  }
)

export function requestPreviewSessionToken(
  requests: Map<string, Promise<string>>,
  origin: string,
  client: LocalConnection
) {
  const current = requests.get(origin)
  if (current) return current
  const request = client.previewToken().finally(() => {
    if (requests.get(origin) === request) requests.delete(origin)
  })
  requests.set(origin, request)
  return request
}
