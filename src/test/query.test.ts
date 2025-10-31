import {suite} from '@alinea/suite'
import {Edit, Query} from 'alinea'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {config} from './example.js'

const test = suite(import.meta)

const {Page} = config.schema

async function createDb() {
  const db = new LocalDB(config)
  await db.sync()
  return db
}

test('filters', async () => {
  const db = await createDb()
  const entry = await db.create({
    type: Page,
    set: {
      title: 'New entry',
      entryLink: Edit.links(Page.entryLink).addEntry('xyz').value(),
      list: Edit.list(Page.list)
        .add('item', {
          itemId: 'item-1'
        })
        .value()
    }
  })
  const result = await db.find({
    type: Page,
    filter: {
      list: {includes: {itemId: 'item-1'}}
    }
  })
  test.is(result.length, 1)
  const result2 = await db.find({
    type: Page,
    filter: {
      entryLink: {
        includes: {
          _entry: 'xyz'
        }
      }
    }
  })
  test.is(result2.length, 1)
  const result3 = await db.find({
    type: Page,
    id: {in: ['a', 'b', 'c']}
  })
  test.is(result3.length, 0)
})

test('filter location', async () => {
  const db = await createDb()
  const [localised3] = await db.find({
    location: config.workspaces.main.multiLanguage.localised2
  })
  test.is(localised3?._path, 'localised3')

  const rootEntries = await db.find({
    root: config.workspaces.main.pages
  })
  test.is(rootEntries.length, 4)
})

test('take/skip', async () => {
  const db = await createDb()
  const lastTwo = await db.find({
    root: config.workspaces.main.pages,
    skip: 1,
    take: 2
  })
  test.is(lastTwo.length, 2)
  const lastOne = await db.find({
    root: config.workspaces.main.pages,
    skip: 2,
    take: 1
  })
  test.is(lastOne.length, 1)
})

test('parents order', async () => {
  const db = await createDb()
  const parent1 = await db.create({
    type: Page,
    set: {title: 'Parent 1'}
  })
  const parent2 = await db.create({
    type: Page,
    parentId: parent1._id,
    set: {title: 'Parent 2'}
  })
  const child1 = await db.create({
    type: Page,
    parentId: parent2._id,
    set: {title: 'Child 1'}
  })
  const parentIds = await db.get({
    id: child1._id,
    select: Query.parents({
      select: Query.id
    })
  })
  test.equal(parentIds, [parent1._id, parent2._id])
})
