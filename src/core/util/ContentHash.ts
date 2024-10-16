import {crypto} from '@alinea/iso'
import {EntryRow} from '../EntryRow.js'

export function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 8)
}

export async function createFileHash(data: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

export async function createRowHash(entry: Omit<EntryRow, 'rowHash'>) {
  const encoder = new TextEncoder()
  const data = encoder.encode(
    `entryId ${entry.entryId}` +
      `phase ${entry.phase}` +
      `title ${entry.title}` +
      `type ${entry.type}` +
      `seeded ${entry.seeded}` +
      `workspace ${entry.workspace}` +
      `root ${entry.root}` +
      `level ${entry.level}` +
      `filePath ${entry.filePath}` +
      `parentDir ${entry.parentDir}` +
      `childrenDir ${entry.childrenDir}` +
      `index ${entry.index}` +
      `parent ${entry.parent}` +
      `i18nId ${entry.i18nId}` +
      `locale ${entry.locale}` +
      `fileHash ${entry.fileHash}` +
      `active ${entry.active}` +
      `main ${entry.main}` +
      `path ${entry.path}` +
      `url ${entry.url}`
  )
  return createFileHash(data)
}
