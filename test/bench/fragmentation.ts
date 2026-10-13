/**
 * Measures how a database synced from scratch, as the dashboard's first load
 * does, lays out its pages: the share of each table's leaf pages, in key
 * order, whose next leaf lies at most 16 pages further in the file (the
 * pages between are overflow pages of large rows). Readers of stored bases read ahead, which
 * only pays off for tables whose pages are contiguous. Writes the synced
 * database, a compacted copy and the SQL of a few searches, to replay them in
 * a browser.
 *
 * With rounds, it then syncs that many rounds of edits to a hundred entries,
 * as a site that has been edited for a while.
 *
 *   bun test/bench/fragmentation.ts [files] [rounds] [out dir]
 */
import {Entry} from '#/core/Entry.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {DatabaseSource} from '#/database/DatabaseSource.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {Database} from 'bun:sqlite'
import {mkdir, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {sql} from 'rado'
import {connect} from 'rado/driver/bun-sqlite'
import {cms} from './initial-sync.cms.js'
import {content} from './initial-sync.content.js'

const size = Number(process.argv[2] ?? 20_000)
const rounds = Number(process.argv[3] ?? 0)
const out = process.argv[4] ?? join(tmpdir(), 'alinea-fragmentation')
const {config} = cms

await mkdir(out, {recursive: true})
const synced = join(out, 'synced.sqlite')
const compacted = join(out, 'compacted.sqlite')
await rm(synced, {force: true})
await rm(compacted, {force: true})

const files = content(size)
const source = new MemorySource()
await source.applyChanges({
  fromSha: ReadonlyTree.EMPTY.sha,
  changes: await Promise.all(
    files.map(async file => ({
      op: 'add' as const,
      path: file.path,
      sha: await hashBlob(file.contents),
      contents: file.contents
    }))
  )
})

// As the dashboard's store: 16 KiB pages, then the schema, then one sync
const sqlite = new Database(synced)
sqlite.run('pragma page_size = 16384')
const db = connect(sqlite)
await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
const database = new EntryDatabase(config, db)
const store = new EntryStore(config, database, new DatabaseSource(database), {
  ownsDatabase: false,
  sourceFollowsDatabase: true
})
const start = performance.now()
await store.syncWith(source)
console.log(
  `synced ${size} files in ${(performance.now() - start).toFixed(0)}ms`
)

// Rounds of edits: a hundred entries get a longer title and body each time
const decoder = new TextDecoder()
const encoder = new TextEncoder()
const entries = files.filter(file => !/\/file-\d+\.json$/.test(file.path))
for (let round = 1; round <= rounds; round++) {
  const changes = await Promise.all(
    Array.from({length: 100}, async (_, i) => {
      const file = entries[(round * 7919 + i * 104729) % entries.length]!
      const record = JSON.parse(decoder.decode(file.contents))
      file.contents = encoder.encode(
        JSON.stringify(
          {
            ...record,
            title: `${record.title} ${round}`,
            edit: 'x'.repeat(round * 10)
          },
          null,
          2
        )
      )
      return {
        op: 'add' as const,
        path: file.path,
        sha: await hashBlob(file.contents),
        contents: file.contents
      }
    })
  )
  const tree = await source.getTree()
  await source.applyChanges({fromSha: tree.sha, changes})
  await store.syncWith(source)
}
if (rounds) console.log(`synced ${rounds} rounds of 100 edits`)

// The search statements, recorded as the explorer runs them
const recorded: Record<string, Array<{sql: string; params: unknown[]}>> = {}
let recording: Array<{sql: string; params: unknown[]}> | undefined
const prepare = sqlite.prepare.bind(sqlite)
sqlite.prepare = ((query: string, ...rest: Array<never>) => {
  const statement = prepare(query, ...rest)
  for (const method of ['all', 'get', 'values', 'run'] as const) {
    const original = statement[method].bind(statement) as (
      ...params: Array<unknown>
    ) => unknown
    Object.assign(statement, {
      [method]: (...params: Array<unknown>) => {
        recording?.push({sql: query, params: params.flat()})
        return original(...params)
      }
    })
  }
  return statement
}) as typeof sqlite.prepare
for (const term of ['l', 'lo', 'lorem', 'dolor sit', 'consectetur', 'magna']) {
  recording = []
  await database.find({
    search: term,
    status: 'preferDraft',
    take: 100,
    groupBy: Entry.id,
    select: {id: Entry.id, title: Entry.title, data: Entry.data}
  })
  recorded[term] = recording
}
recording = undefined
await Bun.write(join(out, 'queries.json'), JSON.stringify(recorded))

function report(label: string, file: Database) {
  const rows = file
    .query<{name: string; pageno: number}, []>(
      `select name, pageno from dbstat where pagetype = 'leaf' order by name, path`
    )
    .all()
  const tables = new Map<string, Array<number>>()
  for (const row of rows) {
    const pages = tables.get(row.name) ?? []
    pages.push(row.pageno)
    tables.set(row.name, pages)
  }
  const total = {pages: 0, following: 0}
  const lines = Array.from(tables, ([name, pages]) => {
    let following = 0
    for (let i = 1; i < pages.length; i++) {
      const step = pages[i]! - pages[i - 1]!
      if (step > 0 && step <= 16) following++
    }
    total.pages += pages.length
    total.following += following
    return {name, pages: pages.length, following}
  })
    .sort((a, b) => b.pages - a.pages)
    .slice(0, 6)
  console.log(`\n${label}`)
  for (const {name, pages, following} of lines)
    console.log(
      `  ${name.padEnd(36)} ${String(pages).padStart(6)} leaves  ${((following / Math.max(1, pages - 1)) * 100).toFixed(0).padStart(3)}% in order`
    )
  console.log(
    `  ${'all'.padEnd(36)} ${String(total.pages).padStart(6)} leaves  ${((total.following / Math.max(1, total.pages - 1)) * 100).toFixed(0).padStart(3)}% in order`
  )
}

report('synced', sqlite)
await db.run(sql`vacuum into ${compacted}`)
sqlite.close()
const copy = new Database(compacted, {readonly: true})
report('compacted (vacuum into)', copy)
copy.close()
console.log(`\nwrote ${out}`)
