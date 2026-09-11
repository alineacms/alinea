import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {
  transaction,
  type Source,
  type SourceTransaction
} from '#/core/source/Source.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {EntryDatabase} from '../EntryDatabase.js'
import {snippet} from '#/core/pages/Snippet.js'

const Page = ConfigBuilder.document('Page', {
  fields: {
    title: Field.text('Title'),
    body: Field.text('Body', {searchable: true})
  }
})
const config: Config = {
  schema: {Page},
  workspaces: {
    main: ConfigBuilder.workspace('Main', {
      source: 'content',
      roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
    })
  }
}

function entry(id: string, title: string, body = ''): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({_id: id, _type: 'Page', _index: id, title, body})
  )
}

async function applySourceChange(
  source: Source,
  change: Awaited<ReturnType<SourceTransaction['compile']>>
): Promise<void> {
  await source.applyChanges({fromSha: change.from.sha, changes: change.changes})
}

for (const driver of ['native', 'wasm'] as const)
  test(`${driver} FTS queries rank titles, combine prefixes and update transactionally`, async () => {
    const db =
      driver === 'native'
        ? connect(new Database(':memory:'))
        : await wasmDatabase()
    try {
      const source = new MemorySource()
      await EntryDatabase.createSchema(db, (await source.getTree()).sha)
      const runtime = new EntryDatabase(config, db)
      const initial = await transaction(source)
      await applySourceChange(
        source,
        await initial
          .add('pages/a.json', entry('a', 'Other', 'baking chocolate cookies'))
          .add(
            'pages/b.json',
            entry('b', 'Chocolate cookies', 'baking recipes')
          )
          .add('pages/c.json', entry('c', 'Café crème', 'délicieux'))
          .add('pages/d.json', entry('d', 'Ordinary', 'nothing matching'))
          .add('pages/e.json', entry('e', 'Unlocking semiconductor systems'))
          .add('pages/f.json', entry('f', 'Systems unlocked by unlocking'))
          .add('pages/g.json', entry('g', 'Background', 'unlocking systems'))
          .compile()
      )
      await runtime.syncWith(source)
      expect(
        await runtime.resolve({search: ['choco', 'cook'], select: Entry.id})
      ).toEqual(['b', 'a'])
      expect(
        await runtime.resolve({search: 'cafe cre', select: Entry.id})
      ).toEqual(['c'])
      expect(
        await runtime.resolve({search: 'unlocking', select: Entry.id})
      ).toEqual(['e', 'f', 'g'])
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
      const update = await transaction(source)
      await applySourceChange(
        source,
        await update
          .add('pages/a.json', entry('a', 'Vanilla', 'new body'))
          .remove('pages/b.json')
          .compile()
      )
      await runtime.syncWith(source)
      expect(
        await runtime.resolve({search: 'choco', select: Entry.id})
      ).toEqual([])
      expect(await runtime.resolve({search: 'van', select: Entry.id})).toEqual([
        'a'
      ])
      const duplicate = await transaction(source)
      await applySourceChange(
        source,
        await duplicate
          .add('pages/a.json', entry('a', 'Changed'))
          .add('pages/a-copy.json', entry('a', 'Duplicate'))
          .compile()
      )
      await expect(runtime.syncWith(source)).rejects.toThrow('UNIQUE')
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
  const source = new MemorySource()
  await EntryDatabase.createSchema(db, (await source.getTree()).sha)
  const runtime = new EntryDatabase(config, db)
  const initial = await transaction(source)
  await applySourceChange(
    source,
    await initial
      .add('pages/a.json', entry('a', 'First', 'hidden chocolate'))
      .add('pages/b.json', entry('b', 'Second', 'hidden chocolate'))
      .compile()
  )
  await runtime.syncWith(source)
  expect(await runtime.resolve({select: Entry.id})).toEqual(['a', 'b'])
  expect(
    await runtime.resolve({search: 'choco', take: 1, select: Entry.id})
  ).toHaveLength(1)
  const retitle = await transaction(source)
  await applySourceChange(
    source,
    await retitle.add('pages/a.json', entry('a', 'Retitled')).compile()
  )
  await runtime.syncWith(source)
  expect(await runtime.resolve({search: 'retit', select: Entry.id})).toEqual([
    'a'
  ])
  const clearBody = await transaction(source)
  await applySourceChange(
    source,
    await clearBody.add('pages/b.json', entry('b', 'Second')).compile()
  )
  await runtime.syncWith(source)
  expect(await runtime.resolve({search: 'choco', select: Entry.id})).toEqual([])
  expect(
    sqlite.query('select count(*) as count from alinea_entry_search').get()
  ).toEqual({count: 2})
})
