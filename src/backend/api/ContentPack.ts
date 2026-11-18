import {type ObjectStore, type StoredObject} from '@alinea/graft'
import {writePack} from '@alinea/graft/git'
import {compareTrees} from '#/core/source/CompareTrees.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {objectReader} from '#/core/source/TreeObjects.js'

/**
 * A pack of the objects content tree `head` holds that `have` does not, as
 * far as the directories that changed tell: a moved directory is not sent
 * again. Objects changed in place are deltas of their version in `have`,
 * which the receiver holds (a thin pack). Without `have` it holds all.
 */
export async function writeContentPack(
  objects: ObjectStore,
  have: string | undefined,
  head: string
): Promise<Uint8Array> {
  const from = have ?? ReadonlyTree.EMPTY.sha
  const comparison = await compareTrees(objectReader(objects), from, head)
  const {known, previous} = comparison
  const wanted = new Set<string>()
  for (const sha of comparison.read) wanted.add(sha)
  for (const change of comparison.changes)
    if (change.op === 'add') wanted.add(change.sha)
  for (const sha of known) wanted.delete(sha)
  wanted.delete(ReadonlyTree.EMPTY.sha)
  const bases = new Set<string>()
  for (const sha of wanted) {
    const base = previous.get(sha)
    if (base) bases.add(base)
  }
  const found = await objects.get([...wanted, ...bases])
  const stored = (sha: string): StoredObject => {
    const object = found.get(sha)
    if (!object) throw new Error(`Missing object ${sha}`)
    return {sha, ...object}
  }
  const hints = new Map<string, StoredObject>()
  for (const sha of wanted) {
    const base = previous.get(sha)
    if (base && found.has(base)) hints.set(sha, stored(base))
  }
  // Deltas against neighbours cost a comparison each: a pack of everything
  // is written whole, a few changes try their previous version
  return writePack([...wanted].map(stored), {
    bases: hints,
    window: have ? 1 : 0
  })
}
