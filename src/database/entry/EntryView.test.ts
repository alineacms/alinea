import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {asc, eq} from 'rado'
import {connect} from 'rado/driver/bun-sqlite'
import {EntryDatabase} from '../EntryDatabase.js'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {EntryView} from './EntryView.js'
import {EntryIndexTable, entryIndexRow, type IndexedEntry} from './Schema.js'

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

test('named entry views compose changes and clean up independently', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, 'base')
  await db
    .insert(EntryIndexTable)
    .values([row('a', 'Base A'), row('b', 'Base B')])

  const github = await EntryView.create(db, 'github', EntryIndexTable, 'base')
  await db
    .update(github.entries)
    .set({title: 'GitHub A'})
    .where(eq(github.entries.id, 'a'))
  await db.delete(github.entries).where(eq(github.entries.id, 'b'))
  await db.insert(github.entries).values(row('c', 'GitHub C'))

  const preview = await EntryView.create(
    db,
    'preview_request_1',
    github.entries,
    'github'
  )
  await db
    .update(preview.entries)
    .set({title: 'Preview A'})
    .where(eq(preview.entries.id, 'a'))
  await db.insert(preview.entries).values(row('b', 'Preview B'))

  expect(
    await db
      .select({id: preview.entries.id, title: preview.entries.title})
      .from(preview.entries)
      .orderBy(asc(preview.entries.id))
  ).toEqual([
    {id: 'a', title: 'Preview A'},
    {id: 'b', title: 'Preview B'},
    {id: 'c', title: 'GitHub C'}
  ])
  expect(await github.getRevision()).toBe('base')
  expect(await preview.getRevision()).toBe('github')

  await preview.close()
  expect(
    await db
      .select({id: github.entries.id, title: github.entries.title})
      .from(github.entries)
      .orderBy(asc(github.entries.id))
  ).toEqual([
    {id: 'a', title: 'GitHub A'},
    {id: 'c', title: 'GitHub C'}
  ])

  await github.close()
  expect(
    await db
      .select({id: EntryIndexTable.id, title: EntryIndexTable.title})
      .from(EntryIndexTable)
      .orderBy(asc(EntryIndexTable.id))
  ).toEqual([
    {id: 'a', title: 'Base A'},
    {id: 'b', title: 'Base B'}
  ])
})

test('entry views remain writable over a readonly base database', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-readonly-view-'))
  const path = join(directory, 'entries.sqlite')
  try {
    const writer = new Database(path, {create: true})
    const writeDb = connect(writer)
    await EntryDatabase.createSchema(writeDb, 'base')
    await writeDb.insert(EntryIndexTable).values(row('a', 'Base A'))
    writer.close()

    const reader = new Database(path, {readonly: true})
    try {
      const db = connect(reader)
      const overlay = await EntryView.create(
        db,
        'readonly',
        EntryIndexTable,
        'base'
      )
      await db
        .update(overlay.entries)
        .set({title: 'Overlay A'})
        .where(eq(overlay.entries.id, 'a'))
      expect(
        await db
          .select(overlay.entries.title)
          .from(overlay.entries)
          .where(eq(overlay.entries.id, 'a'))
          .get()
      ).toBe('Overlay A')
      await overlay.close()
    } finally {
      reader.close()
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
    const overlay = await EntryView.create(db, 'wasm', EntryIndexTable, 'base')
    await db
      .update(overlay.entries)
      .set({title: 'Overlay A'})
      .where(eq(overlay.entries.id, 'a'))
    expect(
      await db
        .select(overlay.entries.title)
        .from(overlay.entries)
        .where(eq(overlay.entries.id, 'a'))
        .get()
    ).toBe('Overlay A')
    await overlay.close()
  } finally {
    await db.close()
  }
})
