import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {connect} from 'rado/driver/bun-sqlite'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {createGeneratedDatabase} from './GeneratedDatabase.js'

const Page = ConfigBuilder.document('Page', {
  fields: {title: Field.text('Title')}
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

test('a read-only generated database commits after searching', async () => {
  const file = join(
    await mkdtemp(join(tmpdir(), 'alinea-generated-')),
    'db.sqlite'
  )
  const sqlite = new Database(file)
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, ReadonlyTree.EMPTY.sha)
  const database = new EntryDatabase(config, db)
  const store = new EntryStore(config, database, new MemorySource())
  await store.mutate(
    ['page', 'other'].map(id => ({
      op: 'create' as const,
      id,
      type: 'Page',
      locale: null,
      data: {title: `Title ${id}`}
    }))
  )
  await database.compact()
  await database.close()
  sqlite.close()

  const generated = await createGeneratedDatabase(
    config,
    connect(new Database(file, {readonly: true}))
  )
  try {
    // A search first: writes must never reach the shared, read-only index.
    expect(await generated.find({search: 'title', select: Entry.id})).toEqual([
      'page',
      'other'
    ])
    const request = await generated.request([
      {
        op: 'update',
        id: 'page',
        locale: null,
        status: 'published',
        set: {title: 'Changed'}
      }
    ])
    expect(await generated.write(request)).toEqual({sha: request.intoSha})
    expect(await generated.find({search: 'changed', select: Entry.id})).toEqual(
      ['page']
    )
  } finally {
    await generated.close()
  }
})
