import {EntryPhase} from 'alinea/core'
import xxhash from 'xxhash-wasm'

const xxHash = xxhash()
const textEncoder = new TextEncoder()

export async function createContentHash(
  modifiedAt: number,
  phase: EntryPhase,
  contents: Uint8Array,
  seed?: string
) {
  const {h32Raw} = await xxHash
  const modifedAtData = new Uint8Array(8)
  new DataView(modifedAtData.buffer).setBigUint64(0, BigInt(modifiedAt))
  const seedData = seed ? textEncoder.encode(seed) : new Uint8Array(0)
  const phaseData = textEncoder.encode(phase)
  const hashData = new Uint8Array(
    modifedAtData.length + seedData.length + phaseData.length + contents.length
  )
  hashData.set(modifedAtData)
  hashData.set(seedData)
  hashData.set(phaseData, seedData.length)
  hashData.set(contents, seedData.length + phaseData.length)
  return h32Raw(hashData).toString(16).padStart(8, '0')
}
