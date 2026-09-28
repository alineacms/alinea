import {Entry} from '#/core/Entry.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {Edit} from '#/index.js'
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {config} from '#test/example.js'

const {Page} = config.schema

test('links of all result rows resolve in one query', async () => {
  let statements = 0
  const db = connect(new Database(':memory:'), {
    logQuery() {
      statements++
    }
  })
  await EntryDatabase.createSchema(db, config, ReadonlyTree.EMPTY.sha)
  const store = new EntryStore(
    config,
    new EntryDatabase(config, db),
    new MemorySource()
  )
  const targets = ['a', 'b', 'c']
  const sources = ['s1', 's2', 's3', 's4']
  await store.mutate([
    ...targets.map(id => ({
      op: 'create' as const,
      id,
      type: 'Page',
      locale: null,
      data: {title: `Target ${id}`, path: id}
    })),
    ...sources.map((id, index) => ({
      op: 'create' as const,
      id,
      type: 'Page',
      locale: null,
      data: {
        title: `Source ${id}`,
        path: id,
        // Each source links two targets; neighbours share one of them.
        entryLink: Edit.links(Page.entryLink)
          .addEntry(targets[index % 3])
          .addEntry(targets[(index + 1) % 3])
          .value()
      }
    }))
  ])
  statements = 0
  const rows = await store.find({
    type: Page,
    id: {in: sources},
    select: {id: Entry.id, entryLink: Page.entryLink}
  })
  expect(statements).toBe(2)
  expect(
    rows.map(row => [
      row.id,
      row.entryLink.map(link => (link as {entryId: string}).entryId)
    ])
  ).toEqual([
    ['s1', ['a', 'b']],
    ['s2', ['b', 'c']],
    ['s3', ['c', 'a']],
    ['s4', ['a', 'b']]
  ])
})
