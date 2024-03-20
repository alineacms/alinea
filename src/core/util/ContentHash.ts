import xxhash from 'xxhash-wasm'
import {EntryRow} from '../EntryRow.js'

const xxHash = xxhash()

export async function createFileHash(data: Uint8Array) {
  const {h32Raw} = await xxHash
  return h32Raw(data).toString(16).padStart(8, '0')
}

export async function createRowHash(entry: Omit<EntryRow, 'rowHash'>) {
  const {create32} = await xxhash()
  const hash = create32()
    .update(`entryId ${entry.entryId}`)
    .update(`phase ${entry.phase}`)
    .update(`title ${entry.title}`)
    .update(`type ${entry.type}`)
    .update(`seeded ${entry.seeded}`)
    .update(`workspace ${entry.workspace}`)
    .update(`root ${entry.root}`)
    .update(`level ${entry.level}`)
    .update(`filePath ${entry.filePath}`)
    .update(`parentDir ${entry.parentDir}`)
    .update(`childrenDir ${entry.childrenDir}`)
    .update(`index ${entry.index}`)
    .update(`parent ${entry.parent}`)
    .update(`i18nId ${entry.i18nId}`)
    .update(`locale ${entry.locale}`)
    .update(`fileHash ${entry.fileHash}`)
    .update(`active ${entry.active}`)
    .update(`main ${entry.main}`)
    .update(`path ${entry.path}`)
    .update(`url ${entry.url}`)
  return hash.digest().toString(16).padStart(8, '0')
}
