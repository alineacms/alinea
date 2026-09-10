import type {Config} from '#/core/Config.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {buildDatabase} from '#/database/runtime/BuildDatabase.js'
import {
  CheckpointTable,
  openCheckpoint,
  type CheckpointIdentity
} from '#/database/runtime/Checkpoint.js'
import type {CheckpointSource} from '#/database/driver/NodeReplica.js'
import {exportSource} from '#/core/source/SourceExport.js'
import {SqlSource} from '#/database/source/SqlSource.js'
import {eq} from 'rado'
import {mkdir, mkdtemp, rename, rm, stat, writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {nodeDatabase} from '#/database/driver/NodeDatabase.js'

/** Publish one immutable SQLite checkpoint and its generated loader. */
export async function exportDatabase(
  config: Config,
  source: RemoteSource | CheckpointSource,
  outDir: string,
  identity: CheckpointIdentity
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
        await db
          .update(CheckpointTable)
          .set({releaseId: identity.releaseId})
          .where(eq(CheckpointTable.id, 1))
      } else if (!('captureCheckpoint' in source)) {
        await buildDatabase(config, db, source, identity)
      } else throw new Error('Missing checkpoint source')
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
export async function openDatabase(config) {
  const {NodeCheckpoint} = await import('alinea/database/driver/NodeCheckpoint')
  return NodeCheckpoint.open(config, databasePath, identity)
}
export async function openReplica(config, directory) {
  const {NodeReplica} = await import('alinea/database/driver/NodeReplica')
  const owned = !directory
  if (!directory) {
    const {mkdtemp} = await import('node:fs/promises')
    const {tmpdir} = await import('node:os')
    const {join} = await import('node:path')
    directory = await mkdtemp(join(tmpdir(), 'alinea-live-'))
  }
  try {
    return await NodeReplica.open({config, directory, identity}, {checkpoint: databasePath})
  } catch (error) {
    if (owned) {
      const {rm} = await import('node:fs/promises')
      await rm(directory, {recursive: true, force: true})
    }
    throw error
  }
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
