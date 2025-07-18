import {suite} from '@alinea/suite'
import {Config, Query} from 'alinea'
import {createCMS, Entry} from 'alinea/core'
import {LocalDB} from 'alinea/core/db/LocalDB'

const test = suite(import.meta)

const Page = Config.document('Page', {
  contains: ['Page'],
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
  schema: {Page},
  workspaces: {main}
})

test('insert order', async () => {
  const db = new LocalDB(cms.config)
  const parent = await db.create({
    type: Page,
    set: {title: 'Parent'}
  })
  const child1 = await db.create({
    type: Page,
    parentId: parent._id,
    set: {title: 'Child 1'}
  })
  const child2 = await db.create({
    type: Page,
    parentId: parent._id,
    set: {title: 'Child 2'},
    insertOrder: 'first'
  })
  const child3 = await db.create({
    type: Page,
    parentId: parent._id,
    set: {title: 'Child 3'},
    insertOrder: 'last'
  })
  const children = await db.find({
    parentId: parent._id,
    select: Query.id
  })
  test.equal(children, [child2._id, child1._id, child3._id])
})
