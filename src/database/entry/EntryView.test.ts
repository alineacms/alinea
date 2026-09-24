import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {asc, eq, sql} from 'rado'
import {connect} from 'rado/driver/bun-sqlite'
import {EntryDatabase} from '../EntryDatabase.js'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {EntrySyncRoot} from '../sync/EntrySyncer.js'
import {entryReadTarget, EntryView} from './EntryView.js'
import {
  EntryIndexTable,
  entryIndexRow,
  type EntryIndexTarget,
  type IndexedEntry
} from './EntryTable.js'

function row(id: string, title: string) {
  return entryIndexRow({
    id,
    locale: null,
    versionStatus: 'published',
    status: 'published',
    type: 'Page',
    title,
    workspace: 'main',
    root: 'pages',
    sourceRoot: null,
    parentId: null,
    parents: [],
    level: 0,
    index: id,
    path: id,
    filePath: `pages/${id}.json`,
    fileHash: `${id}-hash`,
    parentDir: 'pages',
    childrenDir: `pages/${id}`,
    url: `/${id}`,
    active: true,
    main: true,
    visible: true,
    seeded: null,
    rowHash: `${id}-row`,
    childrenSha: null,
    searchableText: title,
    data: {_id: id, _type: 'Page', title}
  } satisfies IndexedEntry)
}

test('entry views read their parent until written, then copy it', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, 'base')
  await db
    .insert(EntryIndexTable)
    .values([row('a', 'Base A'), row('b', 'Base B')])
  const titles = (target: EntryIndexTarget) =>
    db
      .select({id: target.id, title: target.title})
      .from(target)
      .orderBy(asc(target.id))

  const github = await EntryView.create(db, 'github', EntrySyncRoot, 'base')
  const preview = await EntryView.create(db, 'preview', github.target, 'base')
  // Unwritten views, nested ones too, read the base table itself.
  expect(entryReadTarget(github.target)).toBe(EntrySyncRoot)
  expect(entryReadTarget(preview.target)).toBe(EntrySyncRoot)

  await github.diverge()
  await github.diverge()
  expect(entryReadTarget(github.target)).toBe(github.target)
  expect(entryReadTarget(preview.target)).toBe(github.target)
  await db
    .update(github.target.entries)
    .set({title: 'GitHub A'})
    .where(eq(github.target.entries.id, 'a'))
  await db
    .delete(github.target.entries)
    .where(eq(github.target.entries.id, 'b'))
  await db.insert(github.target.entries).values(row('c', 'GitHub C'))

  await preview.diverge()
  await db
    .update(preview.target.entries)
    .set({title: 'Preview A'})
    .where(eq(preview.target.entries.id, 'a'))
  await db.insert(preview.target.entries).values(row('b', 'Preview B'))
  // A written view is a snapshot: later changes to its parent stay hidden.
  await db
    .delete(github.target.entries)
    .where(eq(github.target.entries.id, 'c'))

  expect(await titles(preview.target.entries)).toEqual([
    {id: 'a', title: 'Preview A'},
    {id: 'b', title: 'Preview B'},
    {id: 'c', title: 'GitHub C'}
  ])
  await preview.close()
  expect(await titles(github.target.entries)).toEqual([
    {id: 'a', title: 'GitHub A'}
  ])
  await github.close()
  expect(await titles(EntryIndexTable)).toEqual([
    {id: 'a', title: 'Base A'},
    {id: 'b', title: 'Base B'}
  ])
  expect(
    await db.all(sql`select name from sqlite_temp_master where type = 'table'`)
  ).toEqual([])
})

test('entry views remain writable over a readonly base database', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-readonly-view-'))
  const path = join(directory, 'entries.sqlite')
  try {
    const writer = new Database(path, {create: true})
    const writeDb = connect(writer)
    await EntryDatabase.createSchema(writeDb, 'base')
    await writeDb.insert(EntryIndexTable).values(row('a', 'Base A'))
    await writeDb.close()

    const reader = new Database(path, {readonly: true})
    const db = connect(reader)
    try {
      const overlay = await EntryView.create(
        db,
        'readonly',
        EntrySyncRoot,
        'base'
      )
      await overlay.diverge()
      await db
        .update(overlay.target.entries)
        .set({title: 'Overlay A'})
        .where(eq(overlay.target.entries.id, 'a'))
      expect(
        await db
          .select(overlay.target.entries.title)
          .from(overlay.target.entries)
          .where(eq(overlay.target.entries.id, 'a'))
          .get()
      ).toBe('Overlay A')
      await overlay.close()
    } finally {
      await db.close()
    }
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})

test('entry views remain writable in SQLite WASM', async () => {
  const db = await wasmDatabase()
  try {
    await EntryDatabase.createSchema(db, 'base')
    await db.insert(EntryIndexTable).values(row('a', 'Base A'))
    const overlay = await EntryView.create(db, 'wasm', EntrySyncRoot, 'base')
    await overlay.diverge()
    await db
      .update(overlay.target.entries)
      .set({title: 'Overlay A'})
      .where(eq(overlay.target.entries.id, 'a'))
    expect(
      await db
        .select(overlay.target.entries.title)
        .from(overlay.target.entries)
        .where(eq(overlay.target.entries.id, 'a'))
        .get()
    ).toBe('Overlay A')
    await overlay.close()
  } finally {
    await db.close()
  }
})

test('a written view copies the search rows under their rowids', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, 'base')
  for (const id of ['a', 'b']) {
    await db.insert(EntryIndexTable).values(row(id, `Base ${id}`))
    await db.run(sql`insert into alinea_entry_search (rowid, title, body)
      values (last_insert_rowid(), ${`Base ${id}`}, ${`text of ${id}`})`)
  }
  const view = await EntryView.create(db, 'copy', EntrySyncRoot, 'base')
  await view.diverge()
  const {entries, search} = view.target
  const rows = (target = EntrySyncRoot) =>
    db
      .select({id: target.entries.id, body: target.search.body})
      .from(target.entries)
      .innerJoin(target.search, eq(target.search.rowid, target.entries.rowid))
      .orderBy(asc(target.entries.id))
  expect(await rows(view.target)).toEqual(await rows())
  expect(await rows(view.target)).toEqual([
    {id: 'a', body: 'text of a'},
    {id: 'b', body: 'text of b'}
  ])
  expect(
    await db
      .select(sql`count(*)`)
      .from(search)
      .get()
  ).toBe(2)
  expect(
    await db
      .select(sql`count(*)`)
      .from(entries)
      .get()
  ).toBe(2)
  await view.close()
  expect(
    await db.all(sql`select name from sqlite_temp_master where type = 'table'`)
  ).toEqual([])
})
