import type {Config} from '#/core/Config.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {buildDatabase} from '#/database/runtime/BuildDatabase.js'
import {
  CheckpointTable,
  openCheckpoint,
  type CheckpointIdentity
} from '#/database/runtime/Checkpoint.js'
import type {CheckpointSource} from '#/database/driver/NodeReplica.js'
import {
  FrameTable,
  FrameLocationTable,
  populateFrames
} from '#/database/release/FrameStore.js'
import {exportSource} from '#/core/source/SourceExport.js'
import {SqlSource} from '#/database/source/SqlSource.js'
import {eq} from 'rado'
import {mkdir, mkdtemp, rename, rm, stat, writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {nodeDatabase} from '#/database/driver/NodeDatabase.js'
import {exportFrameBundles} from './ExportFrameBundles.js'

/** Keep SQLite and keys private; publish only encrypted frames to the public dir. */
export async function exportDatabase(
  config: Config,
  source: RemoteSource | CheckpointSource,
  outDir: string,
  identity: CheckpointIdentity,
  publicDirectory: string
): Promise<number> {
  const temporary = await mkdtemp(join(outDir, '.checkpoint-'))
  const location = join(temporary, 'release.sqlite')
  const generation = `checkpoints/${randomUUID()}`
  try {
    const captured =
      'captureCheckpoint' in source
        ? await source.captureCheckpoint(location)
        : undefined
    const sqlite = new DatabaseSync(location)
    let sourceModule: string
    try {
      const db = nodeDatabase(sqlite)
      if (captured) {
        const {descriptor} = await openCheckpoint(config, db, {
          ...identity,
          releaseId: captured.identity.releaseId
        })
        if (descriptor.sourceSha !== captured.revision)
          throw new Error('Captured checkpoint revision mismatch')
        if (!identity.releaseId) throw new Error('Missing release identity')
        await db.transaction(
          async tx => {
            await tx.delete(FrameLocationTable)
            await tx.delete(FrameTable)
            await populateFrames(tx, identity)
            await tx
              .update(CheckpointTable)
              .set({releaseId: identity.releaseId})
              .where(eq(CheckpointTable.id, 1))
          },
          {async: true}
        )
      } else if (!('captureCheckpoint' in source)) {
        await buildDatabase(config, db, source, identity)
      } else throw new Error('Missing checkpoint source')
      await exportFrameBundles(db, publicDirectory)
      const exported = await exportSource(new SqlSource(db, identity.namespace))
      sourceModule = `export const source = ${JSON.stringify(exported)}\n`
      sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      sqlite.exec('PRAGMA journal_mode=DELETE')
    } finally {
      sqlite.close()
    }
    const loader = `import {fileURLToPath} from 'node:url'
export const databasePath = fileURLToPath(new URL('./${generation}/release.sqlite', import.meta.url))
export const identity = ${JSON.stringify(identity)}
export const payloadBasePath = '/_alinea/payloads/'
export async function openDatabase(config) {
  const {NodeCheckpoint} = await import('alinea/database/driver/NodeCheckpoint')
  return NodeCheckpoint.open(config, databasePath, identity)
}
export async function openReplica(config, directory) {
  const {NodeReplica} = await import('alinea/database/driver/NodeReplica')
  return NodeReplica.open({config, directory, identity}, {checkpoint: databasePath})
}
`
    await writeFile(join(temporary, 'database.js'), loader)
    await writeFile(join(temporary, 'source.js'), sourceModule)
    const size = (await stat(location)).size
    await mkdir(join(outDir, 'checkpoints'), {recursive: true})
    await mkdir(join(outDir, generation))
    await rename(location, join(outDir, generation, 'release.sqlite'))
    await rename(
      join(temporary, 'source.js'),
      join(outDir, generation, 'source.js')
    )
    await writeFile(
      join(temporary, 'source.js'),
      `export {source} from './${generation}/source.js'\n`
    )
    await rename(join(temporary, 'source.js'), join(outDir, 'source.js'))
    // The database loader is the SQLite publication pointer. Readers retain their
    // immutable generation; a failed switch leaves the previous pair intact.
    await rename(join(temporary, 'database.js'), join(outDir, 'database.js'))
    return size
  } finally {
    await rm(temporary, {recursive: true, force: true})
  }
}
