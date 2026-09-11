import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {Entry} from '#/core/Entry.js'
import {FSSource} from '#/core/source/FSSource.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {syncWith, transaction, type Source} from '#/core/source/Source.js'
import {cms} from '#test/cms.js'
import {eq} from 'rado'
import {DatabaseStateTable, EntryIndexTable} from '../entry/Schema.js'
import {EntryDatabase} from '../EntryDatabase.js'

test('runtime serializes sources through one database-bound syncer', async () => {
  const source = new MemorySource()
  await syncWith(source, new FSSource('test/fixtures/demo'))
  let conditionalTreeRequests = 0
  const remote: Source = {
    getTree() {
      throw new Error('EntrySyncer must use getTreeIfDifferent')
    },
    async getTreeIfDifferent(sha) {
      conditionalTreeRequests++
      return source.getTreeIfDifferent(sha)
    },
    getBlobs(shas, options) {
      return source.getBlobs(shas, options)
    },
    applyChanges(batch) {
      return source.applyChanges(batch)
    }
  }
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryDatabase.createSchema(db, 'empty')
  const runtime = new EntryDatabase(cms.config, db)

  const [first, repeated] = await Promise.all([
    runtime.syncWith(remote),
    runtime.syncWith(remote)
  ])
  expect(repeated).toEqual({revision: first.revision, changedEntryIds: []})
  expect(await runtime.getRevision()).toBe(first.revision)
  expect(
    await db
      .select(DatabaseStateTable.tree)
      .from(DatabaseStateTable)
      .where(eq(DatabaseStateTable.id, 1))
      .get()
  ).toMatchObject({sha: first.revision})
  expect(first.changedEntryIds.length).toBeGreaterThan(0)
  expect(conditionalTreeRequests).toBe(2)
  const recipes = await db
    .select({childrenSha: EntryIndexTable.childrenSha})
    .from(EntryIndexTable)
    .where(eq(EntryIndexTable.id, '2cGLQZvsCCxnguLrwCfPDL8uFkm'))
    .get()
  expect(recipes?.childrenSha).toBe(
    (await source.getTree()).getNode('pages/recipes').sha
  )
  expect(
    await runtime.resolve({
      path: 'recipes',
      select: {title: Entry.title, filePath: Entry.filePath}
    })
  ).toEqual([{title: 'Recipes', filePath: 'pages/recipes.json'}])

  const leafChange = await transaction(source)
  const updatedLeaf = await leafChange
    .add(
      'pages/recipes/chocolate-chip.json',
      new TextEncoder().encode(
        JSON.stringify({
          _id: 'oi4qtV9YaXNRIUDT2s61Y',
          _type: 'DemoRecipe',
          _index: 'Zz',
          _i18nId: 'oi4qtV9YaXNRIUDT2s61Y',
          _root: 'pages',
          title: 'Updated chocolate chip'
        })
      )
    )
    .compile()
  await source.applyChanges({
    fromSha: updatedLeaf.from.sha,
    changes: updatedLeaf.changes
  })

  const leafSync = await runtime.syncWith(remote)
  expect(leafSync.changedEntryIds).toEqual([
    '2cGLQZvsCCxnguLrwCfPDL8uFkm',
    'oi4qtV9YaXNRIUDT2s61Y'
  ])
  expect(
    await runtime.resolve({
      path: 'chocolate-chip',
      select: Entry.title
    })
  ).toEqual(['Updated chocolate chip'])

  const change = await transaction(source)
  const next = await change
    .add(
      'pages/recipes.json',
      new TextEncoder().encode(
        JSON.stringify({
          _id: '2cGLQZvsCCxnguLrwCfPDL8uFkm',
          _type: 'DemoRecipes',
          _index: 'a1',
          _i18nId: '2cGLQZvsCCxnguLrwCfPDL8uFkm',
          _seeded: '/recipes.json',
          _root: 'pages',
          title: 'Updated recipes'
        })
      )
    )
    .compile()
  await source.applyChanges({fromSha: next.from.sha, changes: next.changes})

  const second = await runtime.syncWith(remote)
  expect(second.revision).not.toBe(leafSync.revision)
  expect(second.changedEntryIds).toContain('2cGLQZvsCCxnguLrwCfPDL8uFkm')
  expect(await runtime.getRevision()).toBe(second.revision)
  expect(await runtime.resolve({path: 'recipes', select: Entry.title})).toEqual(
    ['Updated recipes']
  )

  const archive = await transaction(source)
  const archived = await archive
    .rename('pages/recipes.json', 'pages/recipes.archived.json')
    .compile()
  await source.applyChanges({
    fromSha: archived.from.sha,
    changes: archived.changes
  })

  const archivedSync = await runtime.syncWith(remote)
  expect(archivedSync.changedEntryIds).toContain('2cGLQZvsCCxnguLrwCfPDL8uFkm')
  expect(
    await runtime.resolve({status: 'published', select: Entry.path})
  ).not.toContain('recipes')
  expect(
    await runtime.resolve({status: 'archived', select: Entry.path})
  ).toEqual(expect.arrayContaining(['recipes', 'chocolate-chip']))
})
