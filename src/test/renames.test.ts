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
  // Create a draft of page1 with a new path
  const draft = await db.create({
    id: page1._id,
    type: Page,
    status: 'draft',
    set: {path: 'page1-new'}
  })
  // The main path still reflects the published path
  test.is(draft._path, 'page1')
  // The change is stored in the fields
  test.is(draft.path, 'page1-new')

  // Publish the draft
  await db.publish({
    id: draft._id,
    status: 'draft'
  })
  const published = await db.get({
    id: page1._id,
    type: Page
  })
  test.is(published._path, 'page1-new')
  test.is(published.path, 'page1-new')

  // Children are updated as well
  const sub = await db.get({
    id: subPage1._id,
    type: Page
  })
  test.is(sub._url, '/page1-new/sub1')
})
