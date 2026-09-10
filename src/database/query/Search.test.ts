import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {Entry} from '#/core/Entry.js'
import {EntryRuntime, type EntryReplacement} from '../runtime/EntryRuntime.js'
import {entryVersionId} from '../entry/Schema.js'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {snippet} from '#/core/pages/Snippet.js'

function entry(id: string, title: string, body = ''): EntryReplacement {
  return {
    entry: {
      id,
      title,
      locale: null,
      versionStatus: 'published',
      status: 'published',
      type: 'Page',
      workspace: 'main',
      root: 'pages',
      parentId: null,
      parents: [],
      level: 0,
      index: id,
      path: id,
      url: `/${id}`,
      active: true,
      main: true,
      seeded: null,
      rowHash: `${id}:${title}`
    },
    data: {},
    source: {searchableText: body}
  }
}

for (const driver of ['native', 'wasm'] as const)
  test(`${driver} FTS queries rank titles, combine prefixes and update transactionally`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      await EntryRuntime.createSchema(db, 'empty')
      const runtime = new EntryRuntime({schema: {}, workspaces: {}}, db)
      await runtime.apply({
        fromRevision: 'empty',
        toRevision: 'one',
        entries: [
          entry('a', 'Other', 'baking chocolate cookies'),
          entry('b', 'Chocolate cookies', 'baking recipes'),
          entry('c', 'Café crème', 'délicieux'),
          entry('d', 'Ordinary', 'nothing matching')
        ]
      })
      expect(
        await runtime.resolve({search: ['choco', 'cook'], select: Entry.id})
      ).toEqual(['b', 'a'])
      expect(
        await runtime.resolve({search: 'cafe cre', select: Entry.id})
      ).toEqual(['c'])
      expect(
        await runtime.resolve({
          id: 'a',
          search: 'choco',
          select: snippet('[', ']', '...', 4)
        })
      ).toEqual(['baking [chocolate] cookies'])
      await expect(
        runtime.resolve({search: 'choco', select: snippet('[', ']', '...', 0)})
      ).rejects.toThrow('integer from 1 to 64')
      await expect(runtime.resolve({select: snippet()})).rejects.toThrow(
        'requires search terms'
      )
      expect(
        await runtime.resolve({search: '" OR * :', select: Entry.id})
      ).toEqual(['d'])
      expect(
        await runtime.resolve({search: '  !!!  ', select: Entry.id})
      ).toEqual([])
      expect(
        await runtime.resolve({search: 'choco', count: true, skip: 1})
      ).toBe(1)
      expect(
        await runtime.resolve({
          search: 'choco',
          groupBy: Entry.type,
          select: Entry.id
        })
      ).toEqual(['b'])
      expect(
        await runtime.resolve({
          search: 'choco',
          orderBy: {asc: Entry.id},
          select: Entry.id
        })
      ).toEqual(['a', 'b'])
      await runtime.apply({
        fromRevision: 'one',
        toRevision: 'two',
        entries: [entry('a', 'Vanilla', 'new body')],
        removedVersionIds: [entryVersionId('b', null, 'published')]
      })
      expect(
        await runtime.resolve({search: 'choco', select: Entry.id})
      ).toEqual([])
      expect(await runtime.resolve({search: 'van', select: Entry.id})).toEqual([
        'a'
      ])
      await expect(
        runtime.apply({
          fromRevision: 'two',
          toRevision: 'bad',
          entries: [entry('a', 'Changed'), entry('a', 'Duplicate')]
        })
      ).rejects.toThrow('Duplicate')
      expect(await runtime.resolve({search: 'van', select: Entry.id})).toEqual([
        'a'
      ])
    } finally {
      await db.close()
    }
  })

test('search updates complete entry rows transactionally', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime({schema: {}, workspaces: {}}, db)
  const a = entry('a', 'First')
  const b = entry('b', 'Second')
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'one',
    entries: [
      {...a, source: {searchableText: 'hidden chocolate'}},
      {...b, source: {searchableText: 'hidden chocolate'}}
    ]
  })
  expect(await runtime.resolve({select: Entry.id})).toEqual(['a', 'b'])
  expect(
    await runtime.resolve({search: 'choco', take: 1, select: Entry.id})
  ).toHaveLength(1)
  await runtime.apply({
    fromRevision: 'one',
    toRevision: 'two',
    entries: [{...a, entry: {...a.entry, title: 'Retitled'}}]
  })
  expect(await runtime.resolve({search: 'retit', select: Entry.id})).toEqual([
    'a'
  ])
  await runtime.apply({
    fromRevision: 'two',
    toRevision: 'three',
    entries: [{...b, source: {searchableText: ''}}]
  })
  expect(await runtime.resolve({search: 'choco', select: Entry.id})).toEqual([])
  expect(
    sqlite.query('select count(*) as count from alinea_entry_search').get()
  ).toEqual({count: 2})
})
