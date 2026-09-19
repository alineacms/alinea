import {suite} from '@alinea/suite'
import {expect} from 'bun:test'
import {Config, Query} from '#/index.js'
import {Entry, createCMS} from '#/core.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {EntryUrlConflictError} from '#/core/db/EntryUrlConflictError.js'
import {createEntrySource} from './EntryFixture.js'

const test = suite(import.meta)

const Page = Config.document('Page', {
  contains: ['Page'],
  fields: {}
})
const SubPage = Config.document('Page', {
  fields: {}
})
const Restricted = Config.document('Restricted', {
  contains: [SubPage],
  fields: {}
})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {
    pages: Config.root('Pages', {
      children: {
        seeded1: Config.page({
          type: Page
        })
      }
    })
  }
})
const cms = createCMS({
  schema: {Page, Restricted, SubPage},
  workspaces: {main}
})

test('move parent', async () => {
  const db = new LocalDB(cms.config)
  const parent1 = await db.create({
    type: Page,
    set: {title: 'Page 1'}
  })
  const parent2 = await db.create({
    type: Page,
    set: {title: 'Page 2'}
  })
  const child1 = await db.create({
    type: Page,
    parentId: parent1._id,
    set: {title: 'Child 1'}
  })
  const child2 = await db.create({
    type: Page,
    parentId: parent2._id,
    set: {title: 'Child 2'}
  })
  const parent3 = await db.create({
    type: Restricted,
    set: {title: 'Parent 3'}
  })

  // Reparent child1 to parent2
  await db.move({
    id: child1._id,
    target: parent2._id,
    dropPosition: 'on'
  })

  const child1Entry = await db.get({select: Entry, id: child1._id})
  test.equal(child1Entry.parents, [parent2._id])
  test.is(child1Entry.url, '/page-2/child-1')

  // Try reparent to parent3 (should fail)
  await test.throws(async () => {
    await db.move({
      id: child1._id,
      target: parent3._id,
      dropPosition: 'on'
    })
  })

  // Try move seeded entry
  const seeded1 = await db.get({
    path: 'seeded1'
  })
  await test.throws(async () => {
    await db.move({
      id: seeded1._id,
      target: parent3._id,
      dropPosition: 'on'
    })
  })
})

const Leaf = Config.document('Leaf', {
  fields: {}
})
const leafWorkspace = Config.workspace('LeafMain', {
  source: 'content/leaf',
  roots: {
    pages: Config.root('Pages', {contains: ['Leaf']})
  }
})
const leafCms = createCMS({
  schema: {Leaf},
  workspaces: {leaf: leafWorkspace}
})

test('reorder entries in a parent that does not list them', async () => {
  const db = new LocalDB(leafCms.config)
  const source = await createEntrySource(leafCms.config, [
    {id: 'parent', type: 'Leaf', index: 'a0', path: 'parent'},
    {
      id: 'a',
      type: 'Leaf',
      index: 'a1',
      parentPaths: ['parent'],
      path: 'a'
    },
    {
      id: 'b',
      type: 'Leaf',
      index: 'a2',
      parentPaths: ['parent'],
      path: 'b'
    }
  ])
  try {
    await db.syncWith(source)
    await db.move({id: 'b', target: 'a', dropPosition: 'before'})
    const children = await db.get({
      id: 'parent',
      select: Query.children({select: Entry.id})
    })
    test.equal(children, ['b', 'a'])
  } finally {
    await db.close()
  }
})

const MoveLeaf = Config.document('MoveLeaf', {
  contains: ['MoveLeaf'],
  fields: {}
})
const moveCms = createCMS({
  schema: {MoveLeaf},
  workspaces: {
    move: Config.workspace('MoveMain', {
      source: 'content/move',
      roots: {pages: Config.root('Pages', {contains: ['MoveLeaf']})}
    })
  }
})

function samePathSource(status: 'draft' | 'published') {
  return createEntrySource(moveCms.config, [
    {id: 'p1', type: 'MoveLeaf', index: 'a0', path: 'p1'},
    {id: 'p2', type: 'MoveLeaf', index: 'a1', path: 'p2'},
    {
      id: 'a',
      type: 'MoveLeaf',
      index: 'a0',
      parentPaths: ['p1'],
      path: 'same',
      status,
      data: {title: 'A'}
    },
    {
      id: 'b',
      type: 'MoveLeaf',
      index: 'a0',
      parentPaths: ['p2'],
      path: 'same',
      status,
      data: {title: 'B'}
    }
  ])
}

test('move onto a same-path draft sibling dedupes instead of overwriting', async () => {
  const db = new LocalDB(moveCms.config)
  try {
    await db.syncWith(await samePathSource('draft'))
    await db.move({id: 'b', target: 'a', dropPosition: 'before'})
    const rows = await db.find({
      status: 'all',
      select: {id: Entry.id, parentId: Entry.parentId, path: Entry.path}
    })
    test.equal(rows.length, 4)
    const moved = rows.find(row => row.id === 'b')
    test.is(moved?.parentId, 'p1')
    test.is(moved?.path === 'same', false)
    const paths = rows.map(row => `${row.parentId}/${row.path}`)
    test.equal(new Set(paths).size, paths.length)
  } finally {
    await db.close()
  }
})

test('move onto a same-path published sibling throws', async () => {
  const db = new LocalDB(moveCms.config)
  try {
    await db.syncWith(await samePathSource('published'))
    await expect(
      db.move({id: 'b', target: 'a', dropPosition: 'before'})
    ).rejects.toBeInstanceOf(EntryUrlConflictError)
    const rows = await db.find({
      select: {id: Entry.id, parentId: Entry.parentId}
    })
    test.equal(rows.map(row => row.id).sort(), ['a', 'b', 'p1', 'p2'])
    test.is(rows.find(row => row.id === 'b')?.parentId, 'p2')
  } finally {
    await db.close()
  }
})
