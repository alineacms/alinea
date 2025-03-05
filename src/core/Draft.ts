export interface Draft {
  entryId: string
  locale: string | null
  fileHash: string
  draft: Uint8Array
}

export type DraftKey = string & {__brand: 'DraftKey'}

export function formatDraftKey(entry: {
  id: string
  locale: string | null
}): DraftKey {
  return `${entry.id}.${entry.locale ?? ''}` as DraftKey
}

export function parseDraftKey(key: DraftKey) {
  const [entryId, locale] = key.split('.')
  return {entryId, locale: locale || null}
}
