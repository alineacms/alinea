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

test('new entries default to published', async () => {
  const db = new LocalDB(cms.config)
  const page = await db.create({
    type: Page,
    set: {path: 'page1'}
  })
  test.is(page._status, 'published')
})

test('creating new child defaults to archived when parent is archived', async () => {
  const db = new LocalDB(cms.config)
  const parent = await db.create({
    type: Page,
    set: {path: 'page1'},
    status: 'archived'
  })
  const child = await db.create({
    type: Page,
    parentId: parent._id,
    set: {path: 'child'}
  })
  // Dynamically retrieving the archived status inherits from parent
  const archivedChild = await db.get({
    id: child._id,
    select: Entry,
    status: 'archived'
  })
  test.is(archivedChild.status, 'archived')
})

test('archive action', async () => {
  const db = new LocalDB(cms.config)
  const parent = await db.create({
    type: Page,
    set: {path: 'page1'}
  })
  const sub1 = await db.create({
    type: Page,
    parentId: parent._id,
    set: {path: 'sub1'}
  })
  const sub2 = await db.create({
    type: Page,
    parentId: parent._id,
    set: {path: 'sub2'}
  })
  await db.archive({id: parent._id})
  const archivedParent = await db.get({
    id: parent._id,
    select: Entry,
    status: 'archived'
  })
  test.is(archivedParent.status, 'archived')
  const archivedSub1 = await db.get({
    id: sub1._id,
    select: Entry,
    status: 'archived'
  })
  test.is(archivedSub1.status, 'archived')
  const archivedSub2 = await db.get({
    id: sub2._id,
    select: Entry,
    status: 'archived'
  })
  test.is(archivedSub2.status, 'archived')
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

test('new entries default to published', async () => {
  const db = new LocalDB(cms.config)
  const page = await db.create({
    type: Page,
    set: {path: 'page1'}
  })
  test.is(page._status, 'published')
})

test('creating new child defaults to archived when parent is archived', async () => {
  const db = new LocalDB(cms.config)
  const parent = await db.create({
    type: Page,
    set: {path: 'page1'},
    status: 'archived'
  })
  const child = await db.create({
    type: Page,
    parentId: parent._id,
    set: {path: 'child'}
  })
  // Dynamically retrieving the archived status inherits from parent
  const archivedChild = await db.get({
    id: child._id,
    select: Entry,
    status: 'archived'
  })
  test.is(archivedChild.status, 'archived')
})

test('archive action', async () => {
  const db = new LocalDB(cms.config)
  const parent = await db.create({
    type: Page,
    set: {path: 'page1'}
  })
  const sub1 = await db.create({
    type: Page,
    parentId: parent._id,
    set: {path: 'sub1'}
  })
  const sub2 = await db.create({
    type: Page,
    parentId: parent._id,
    set: {path: 'sub2'}
  })
  await db.archive({id: parent._id})
  const archivedParent = await db.get({
    id: parent._id,
    select: Entry,
    status: 'archived'
  })
  test.is(archivedParent.status, 'archived')
  const archivedSub1 = await db.get({
    id: sub1._id,
    select: Entry,
    status: 'archived'
  })
  test.is(archivedSub1.status, 'archived')
  const archivedSub2 = await db.get({
    id: sub2._id,
    select: Entry,
    status: 'archived'
  })
  test.is(archivedSub2.status, 'archived')
})

test('publishing removes other statuses', async () => {
  const db = new LocalDB(cms.config)
  const page1 = await db.create({
    type: Page,
    set: {path: 'page1', title: 'Published'},
    status: 'archived'
  })
  const page1Published = await db.create({
    type: Page,
    id: page1._id,
    set: {path: 'page1', title: 'Draft'}
  })
  const published = await db.get({
    id: page1._id,
    select: Entry
  })
  test.is(published.status, 'published')
})

test('publishing action removes other statuses', async () => {
  const db = new LocalDB(cms.config)
  const page1 = await db.create({
    type: Page,
    set: {path: 'page1', title: 'Published'},
    status: 'archived'
  })
  const page1Draft = await db.create({
    type: Page,
    id: page1._id,
    status: 'draft',
    set: {title: 'Draft'},
    overwrite: true
  })
  await db.publish({
    id: page1._id,
    status: 'archived'
  })
  const published = await db.get({
    id: page1._id,
    select: Entry
  })
  test.is(published.status, 'published')
})

test('unique path check in unpublished', async () => {
  const data = {title: 'John Doe', path: 'john-doe'}
  const db = new LocalDB(cms.config)
  const unpublished = await db.create({
    type: Page,
    set: {path: 'page1', title: 'Unublished'},
    status: 'draft'
  })
  const child1 = await db.create({
    type: Page,
    parentId: unpublished._id,
    set: data,
    status: 'draft'
  })
  const child2 = await db.create({
    type: Page,
    parentId: unpublished._id,
    set: data,
    status: 'draft'
  })
  await db.publish({
    id: unpublished._id,
    status: 'draft'
  })
  // This should not overwrite child1 which has the same path
  await db.publish({
    id: child2._id,
    status: 'draft'
  })
  const first = await db.first({id: child1._id, select: Entry, status: 'draft'})
  test.ok(first)
})
