import {suite} from '@alinea/suite'
import {Config} from 'alinea'
import {createCMS, Entry} from 'alinea/core'
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
  test.is(published._path, 'page1-new')
  test.is(published.path, 'page1-new')

  // Children are updated as well
  const sub = await db.get({
    id: subPage1._id,
    type: Page
  })
  test.is(sub._url, '/page1-new/sub1')
})

test('create new entry draft with same path name as published entry with children, then publish', async () => {
  const db = new LocalDB(cms.config)
  const pagePublished = await db.create({
    type: Page,
    status: 'published',
    set: {path: 'page'}
  })

  // Add child
  const childPublished = await db.create({
    type: Page,
    status: 'published',
    parentId: pagePublished._id,
    set: {path: 'child'}
  })

  // Add draft with same path as published parent
  const pageDraft = await db.create({
    type: Page,
    status: 'draft',
    set: {path: 'page'}
  })

  // Save the same path to the draft
  await db.update({
    id: pageDraft._id,
    status: 'draft',
    set: {path: 'page'}
  })

  const draftPath = await db.get({
    id: pageDraft._id,
    select: Entry.path,
    status: 'draft'
  })

  test.is(draftPath, 'page-1')

  // Now publish the draft
  await db.publish({
    id: pageDraft._id,
    status: 'draft'
  })

  // Verify the published path
  const published = await db.get({
    id: pageDraft._id,
    status: 'published'
  })
  test.is(published._path, 'page-1')

  // Check that the child's path is unchanged
  const child = await db.get({
    id: childPublished._id
  })

  test.is(child._url, '/page/child')
})
