import {suite} from '@alinea/suite'
import {Config} from 'alinea'
import {createCMS} from 'alinea/core'
import {LocalDB} from 'alinea/core/db/LocalDB'

const test = suite(import.meta)

const Page = Config.document('Page', {
  fields: {}
})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {pages: Config.root('Pages', {})}
})
const cms = createCMS({
  schema: {Page},
  workspaces: {main}
})

test('new drafts', async () => {
  const db = new LocalDB(cms.config)
  const page1 = await db.create({
    type: Page,
    status: 'draft',
    set: {path: 'page1'}
  })

  // We should not be able to query the draft if we don't set status to draft
  test.not.ok(
    await db.first({
      id: page1._id
    })
  )
})

test('rename parent via draft', async () => {
  const db = new LocalDB(cms.config)
  const page1 = await db.create({
    type: Page,
    set: {path: 'page1'}
  })
  const subPage1 = await db.create({
    type: Page,
    parentId: page1._id,
    set: {path: 'sub1'}
  })
  // Create a draft of page1
  const draft = await db.create({
    id: page1._id,
    type: Page,
    status: 'draft',
    set: {title: 'new draft'}
  })

  // Remove the draft
  await db.discard({
    id: draft._id,
    status: 'draft'
  })

  // Children are not removed
  const sub = await db.first({
    id: subPage1._id,
    type: Page
  })
  test.ok(sub)
})
