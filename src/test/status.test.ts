import {suite} from '@alinea/suite'
import {Config} from 'alinea'
import {Entry, createCMS} from 'alinea/core'
import {LocalDB} from 'alinea/core/db/LocalDB'

const test = suite(import.meta)

const Page = Config.document('Page', {
  contains: ['Page'],
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

test('persist archived over children', async () => {
  const db = new LocalDB(cms.config)
  const page1 = await db.create({
    type: Page,
    set: {path: 'page1'},
    status: 'archived'
  })
  const subPublished = await db.create({
    type: Page,
    parentId: page1._id,
    set: {path: 'sub1', title: 'Published'},
    status: 'published'
  })
  const published = await db.get({
    id: subPublished._id,
    select: Entry,
    status: 'archived'
  })
  test.is(published.status, 'archived')
  await db.create({
    type: Page,
    id: subPublished._id,
    set: {title: 'Draft'},
    status: 'draft'
  })
  const entry = await db.get({
    id: subPublished._id,
    select: Entry,
    status: 'archived'
  })
  test.is(entry.status, 'archived')
  test.is(entry.title, 'Draft')
})

test('persist unpublished over children', async () => {
  const db = new LocalDB(cms.config)
  const page1 = await db.create({
    type: Page,
    set: {path: 'page1'},
    status: 'draft'
  })
  const subPublished = await db.create({
    type: Page,
    parentId: page1._id,
    set: {path: 'sub1', title: 'Published'},
    status: 'published'
  })
  const published = await db.get({
    id: subPublished._id,
    select: Entry,
    status: 'draft'
  })
  test.is(published.status, 'draft')
  await db.create({
    type: Page,
    id: subPublished._id,
    set: {title: 'Draft'},
    status: 'draft'
  })
  const entry = await db.get({
    id: subPublished._id,
    select: Entry,
    status: 'draft'
  })
  test.is(entry.status, 'draft')
  test.is(entry.title, 'Draft')
})

test('creating new versions default to published if parent is archived/unpublished', async () => {
  const db = new LocalDB(cms.config)
  const parent = await db.create({
    type: Page,
    set: {path: 'page1'},
    status: 'draft'
  })
  const sub = await db.create({
    type: Page,
    parentId: parent._id,
    set: {path: 'sub1', title: 'Published'}
  })
  const entry = await db.get({
    id: sub._id,
    select: Entry,
    status: 'draft'
  })
  test.is(entry.status, 'draft')

  // Now publish the parent
  await db.publish({id: parent._id, status: 'draft'})
  const publishedParent = await db.get({
    id: parent._id,
    select: Entry
  })
  test.is(publishedParent.status, 'published')

  // The sub should now be published as well
  const publishedSub = await db.get({
    id: sub._id,
    select: Entry
  })
  test.is(publishedSub.status, 'published')
})

test('unpublish action', async () => {
  const db = new LocalDB(cms.config)
  const parent = await db.create({
    type: Page,
    set: {path: 'page1'}
  })
  const sub = await db.create({
    type: Page,
    parentId: parent._id,
    set: {path: 'sub1', title: 'Published'}
  })

  // Now unpublish the parent
  await db.unpublish({id: parent._id})

  const draftParent = await db.get({
    id: parent._id,
    select: Entry,
    status: 'draft'
  })
  test.is(draftParent.status, 'draft')

  // The sub should now be unpublished as well
  const draftSub = await db.get({
    id: sub._id,
    select: Entry,
    status: 'draft'
  })
  test.is(draftSub.status, 'draft')
})
