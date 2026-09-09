import type {Config} from '#/core/Config.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {buildDatabase} from '#/database/runtime/BuildDatabase.js'
import type {CheckpointIdentity} from '#/database/runtime/Checkpoint.js'
import {mkdir, mkdtemp, rename, rm, stat, writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {nodeDatabase} from '#/database/driver/NodeDatabase.js'
import {exportFrameBundles} from './ExportFrameBundles.js'

/** Keep SQLite and keys private; publish only encrypted frames to the public dir. */
export async function exportDatabase(
  config: Config,
  source: RemoteSource,
  outDir: string,
  identity: CheckpointIdentity,
  publicDirectory: string
): Promise<number> {
  const temporary = await mkdtemp(join(outDir, '.checkpoint-'))
  const location = join(temporary, 'release.sqlite')
  const generation = `checkpoints/${randomUUID()}`
  try {
    const sqlite = new DatabaseSync(location)
    try {
      const db = nodeDatabase(sqlite)
      await buildDatabase(config, db, source, identity)
      await exportFrameBundles(db, publicDirectory)
      sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      sqlite.exec('PRAGMA journal_mode=DELETE')
    } finally {
      sqlite.close()
    }
    const loader = `import {fileURLToPath} from 'node:url'
export const databasePath = fileURLToPath(new URL('./${generation}/release.sqlite', import.meta.url))
export const identity = ${JSON.stringify(identity)}
export const payloadBasePath = '/_alinea/payloads/'
`
    await writeFile(join(temporary, 'database.js'), loader)
    const size = (await stat(location)).size
    await mkdir(join(outDir, 'checkpoints'), {recursive: true})
    await mkdir(join(outDir, generation))
    await rename(location, join(outDir, generation, 'release.sqlite'))
    // The loader is the only mutable pointer. Existing readers retain their
    // immutable generation; a failed switch leaves the previous pair intact.
    await rename(join(temporary, 'database.js'), join(outDir, 'database.js'))
    return size
  } finally {
    await rm(temporary, {recursive: true, force: true})
  }
}
