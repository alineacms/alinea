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

test('avoid overwriting existing paths', async () => {
  const db = new LocalDB(cms.config)
  const page1 = await db.create({
    type: Page,
    set: {path: 'page1'}
  })
  const page2 = await db.create({
    type: Page,
    set: {path: 'page2'}
  })

  const draft = await db.create({
    id: page2._id,
    type: Page,
    status: 'draft',
    set: {path: 'page1'}
  })

  await db.publish({
    id: draft._id,
    status: 'draft'
  })

  const published = await db.get({
    id: page2._id,
    type: Page
  })

  test.is(published._path, 'page1-1')
})

test('rename via publish', async () => {
  const db = new LocalDB(cms.config)
  const page1 = await db.create({
    type: Page,
    set: {path: 'page1'}
  })
  // Overwrite the published version of page1 with a new path
  await db.create({
    type: Page,
    id: page1._id,
    overwrite: true,
    set: {path: 'page2'}
  })
  const published = await db.get({
    id: page1._id,
    type: Page
  })
  test.is(published._path, 'page2')
})

test('rename via update', async () => {
  const db = new LocalDB(cms.config)
  const page1 = await db.create({
    type: Page,
    set: {path: 'page1'}
  })
  await db.update({
    type: Page,
    id: page1._id,
    set: {path: 'page2'}
  })
  const published = await db.get({
    id: page1._id,
    type: Page
  })
  test.is(published._path, 'page2')
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
  console.log({published})
  test.is(published._path, 'page1-new')
  test.is(published.path, 'page1-new')

  // Children are updated as well
  const sub = await db.get({
    id: subPage1._id,
    type: Page
  })
  test.is(sub._url, '/page1-new/sub1')
})
