import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import {join} from 'node:path'
import {gt, type Database} from 'rado'
import {sha256Hash} from '#/core/source/Utils.js'
import {FrameTable, FrameLocationTable} from '#/database/release/FrameStore.js'
import {packFrames, type PackedFrame} from '#/database/replica/Transport.js'
import {isRecord} from '#/core/util/Objects.js'

export interface BundleExportOptions {
  /** Target bundle size. A larger individual frame is stored alone. */
  targetBytes?: number
}

/** Publish immutable ciphertext before atomically committing its private SQL manifest. */
export async function exportFrameBundles(
  db: Database,
  directory: string,
  options: BundleExportOptions = {}
): Promise<{bundles: number; bytes: number}> {
  const target = options.targetBytes ?? 4 * 1024 * 1024
  if (!Number.isSafeInteger(target) || target < 1 || target > 64 * 1024 * 1024)
    throw new Error('Invalid ciphertext bundle target')
  await mkdir(directory, {recursive: true})
  return db.transaction(
    async tx => {
      // Replacement is transactional: a failed export leaves the previous manifest intact.
      await tx.delete(FrameLocationTable)
      let pending: Array<PackedFrame> = []
      let ids: Array<string> = []
      let size = 0
      let bundles = 0
      let bytes = 0
      async function flush() {
        if (!pending.length) return
        const packed = packFrames(pending)
        const bundle = await sha256Hash(packed.contents)
        const path = join(directory, `${bundle}.bin`)
        const temporary = await mkdtemp(join(directory, '.bundle-'))
        try {
          const complete = join(temporary, 'contents')
          await writeFile(complete, packed.contents)
          try {
            await link(complete, path)
          } catch (error) {
            if (!isRecord(error) || error.code !== 'EEXIST') throw error
            if (
              (await stat(path)).size !== packed.contents.length ||
              (await sha256Hash(await readFile(path))) !== bundle
            )
              throw new Error(
                'Existing ciphertext bundle does not match its identity'
              )
          }
        } finally {
          await rm(temporary, {recursive: true, force: true})
        }
        for (let index = 0; index < ids.length; index++)
          await tx.insert(FrameLocationTable).values({
            id: ids[index],
            bundle,
            offset: packed.locations[index].offset
          })
        bundles++
        bytes += packed.contents.length
        pending = []
        ids = []
        size = 0
      }
      let after: string | undefined
      for (;;) {
        // One bounded frame at a time: never materialize all ciphertext or private keys.
        const row = await tx
          .select({
            id: FrameTable.id,
            descriptor: FrameTable.descriptor,
            ciphertext: FrameTable.ciphertext
          })
          .from(FrameTable)
          .where(after === undefined ? undefined : gt(FrameTable.id, after))
          .orderBy(FrameTable.id)
          .limit(1)
          .get()
        if (!row) break
        if (size + row.ciphertext.length > target) await flush()
        pending.push({
          descriptor: {
            ...row.descriptor,
            nonce: new Uint8Array(row.descriptor.nonce)
          },
          ciphertext: row.ciphertext
        })
        ids.push(row.id)
        size += row.ciphertext.length
        after = row.id
      }
      await flush()
      return {bundles, bytes}
    },
    {async: true}
  )
}
