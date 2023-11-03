import {EntryRow} from 'alinea/core'
import xxhash from 'xxhash-wasm'

const xxHash = xxhash()
const textEncoder = new TextEncoder()

export async function createFileHash(data: Uint8Array) {
  const {h32Raw} = await xxHash
  return h32Raw(data).toString(16).padStart(8, '0')
}

export async function createRowHash(entry: Omit<EntryRow, 'rowHash'>) {
  const {h32Raw} = await xxHash
  const mightHaveRowHash = entry as EntryRow
  const {rowHash, data, ...row} = mightHaveRowHash
  const input = textEncoder.encode(JSON.stringify(row))
  return h32Raw(input).toString(16).padStart(8, '0')
}

/*export async function createContentHash(
  phase: EntryPhase,
  contents: Uint8Array,
  seed?: string
) {
  const {h32Raw} = await xxHash
  const seedData = seed ? textEncoder.encode(seed) : new Uint8Array(0)
  const phaseData = textEncoder.encode(phase)
  const hashData = new Uint8Array(
    seedData.length + phaseData.length + contents.length
  )
  hashData.set(seedData)
  hashData.set(phaseData, seedData.length)
  hashData.set(contents, seedData.length + phaseData.length)
  return h32Raw(hashData).toString(16).padStart(8, '0')
}*/
