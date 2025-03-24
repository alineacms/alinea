import {suite} from '@alinea/suite'
import {Edit} from 'alinea'
import {EntryDB} from 'alinea/sync/db/EntryDB'
import {config} from './example.ts'

const test = suite(import.meta)

const db = new EntryDB(config)
await db.sync()
const {Page} = config.schema

test('filters', async () => {
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
  const lastTwo = await db.find({
    root: db.workspaces.main.pages,
    skip: 1,
    take: 2
  })
  test.is(lastTwo.length, 2)
  const lastOne = await db.find({
    root: db.workspaces.main.pages,
    skip: 2,
    take: 1
  })
  test.is(lastOne.length, 1)
})
