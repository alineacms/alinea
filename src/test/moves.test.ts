import {suite} from '@alinea/suite'
import {Config} from 'alinea'
import {Entry, createCMS} from 'alinea/core'
import {LocalDB} from 'alinea/core/db/LocalDB'

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
    toParent: parent2._id
  })

  const child1Entry = await db.get({select: Entry, id: child1._id})
  test.equal(child1Entry.parents, [parent2._id])
  test.is(child1Entry.url, '/page-2/child-1')

  // Try reparent to parent3 (should fail)
  await test.throws(async () => {
    await db.move({
      id: child1._id,
      toParent: parent3._id
    })
  })

  // Try move seeded entry
  const seeded1 = await db.get({
    path: 'seeded1'
  })
  await test.throws(async () => {
    await db.move({
      id: seeded1._id,
      toParent: parent3._id
    })
  })
})
