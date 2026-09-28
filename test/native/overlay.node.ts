// Runs under Node through test/native.test.ts: Bun's SQLite cannot load the
// native overlay extension, so `bun test` only ever sees the WASM fallback.
import type {DatabaseHandle} from '#/database/driver/DatabaseHandle.js'
import {runtimeDatabase} from '#/database/driver/RuntimeDatabase.js'
import assert from 'node:assert/strict'
import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {sql} from 'rado'

const file = join(await mkdtemp(join(tmpdir(), 'alinea-native-')), 'db.sqlite')
const writer = new DatabaseSync(file)
writer.exec('create table items (value integer)')
writer.exec('insert into items values (1)')

async function count(handle: DatabaseHandle): Promise<number> {
  const row = await handle.database.get<{n: number}>(
    sql`select count(*) as n from items`
  )
  return row!.n
}

// The generated database of a deployment: a native overlay of the file.
const overlay = await runtimeDatabase({path: file, overlay: true})
assert.equal(overlay.driver, 'overlay', 'the native overlay extension loads')
const mmap = (await overlay.database.get(sql`pragma mmap_size`)) as {
  mmap_size: number
}
assert.equal(mmap.mmap_size, 268435456, 'overlays map the file')
await overlay.database.run(sql`insert into items values (2)`)
assert.equal(await count(overlay), 2)

const fork = await overlay.fork!()
const forkMmap = (await fork.database.get(sql`pragma mmap_size`)) as {
  mmap_size: number
}
assert.equal(forkMmap.mmap_size, 268435456, 'forks map the file too')
assert.equal(await count(fork), 2, 'a fork starts from committed state')
await fork.database.run(sql`insert into items values (3)`)
assert.equal(await count(overlay), 2, 'a fork writes only to itself')

// An overlay locks writers of its file out until it closes: only the dev
// server opens the file it writes.
assert.throws(() => writer.exec('insert into items values (4)'), /locked/)
await fork.database.close()
await overlay.database.close()
writer.exec('insert into items values (4)')
writer.close()
