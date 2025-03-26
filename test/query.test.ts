import {suite} from '@alinea/suite'
import {Edit} from 'alinea'
import {EntryDB} from 'alinea/core/db/EntryDB.js'
import {config} from './example.js'

const test = suite(import.meta)

const {Page} = config.schema

async function createDb() {
  const db = new EntryDB(config)
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
