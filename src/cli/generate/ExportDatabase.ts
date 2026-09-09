import type {Config} from '#/core/Config.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {buildDatabase} from '#/database/runtime/BuildDatabase.js'
import type {CheckpointIdentity} from '#/database/runtime/Checkpoint.js'
import {mkdtemp, rename, rm, stat, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {nodeDatabase} from '#/database/driver/NodeDatabase.js'

/** Write into the private generated package, never the application's public dir. */
export async function exportDatabase(
  config: Config,
  source: RemoteSource,
  outDir: string,
  identity: CheckpointIdentity
): Promise<number> {
  const temporary = await mkdtemp(join(outDir, '.checkpoint-'))
  const location = join(temporary, 'release.sqlite')
  try {
    const sqlite = new DatabaseSync(location)
    try {
      await buildDatabase(config, nodeDatabase(sqlite), source, identity)
      sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      sqlite.exec('PRAGMA journal_mode=DELETE')
    } finally {
      sqlite.close()
    }
    const loader = `import {fileURLToPath} from 'node:url'
export const databasePath = fileURLToPath(new URL('./release.sqlite', import.meta.url))
export const identity = ${JSON.stringify(identity)}
`
    await writeFile(join(temporary, 'database.js'), loader)
    const size = (await stat(location)).size
    await rename(location, join(outDir, 'release.sqlite'))
    await rename(join(temporary, 'database.js'), join(outDir, 'database.js'))
    return size
  } finally {
    await rm(temporary, {recursive: true, force: true})
  }
}
