import {createCMS, Entry} from '#/core.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {Config, Field} from '#/index.js'
import {suite} from '@alinea/suite'
import {EntryStore} from './EntryStore.js'

const test = suite(import.meta)

const Article = Config.type('Article', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path'),
    summary: Field.text('Summary', {required: true})
  }
})

const cms = createCMS({
  schema: {Article},
  enableDrafts: true,
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages', {contains: ['Article']})}
    })
  }
})

async function createDb() {
  const db = await EntryStore.memory(cms.config, new MemorySource())
  await db.sync()
  return db
}

test('published entries may have invalid fields', async () => {
  const db = await createDb()
  // An importer writes content that misses required fields
  const created = await db.create({
    type: Article,
    root: 'pages',
    set: {title: 'Article'}
  })
  test.is(created.summary, undefined)
  // Other writes to it are not held up by the missing field
  await db.update({type: Article, id: created._id, set: {title: 'Updated'}})
  const title = await db.get({id: created._id, select: Article.title})
  test.is(title, 'Updated')
})

test('drafts with invalid fields can be published', async () => {
  const db = await createDb()
  const draft = await db.create({
    type: Article,
    root: 'pages',
    status: 'draft',
    set: {title: 'Draft'}
  })
  await db.publish({id: draft._id, locale: null, status: 'draft'})
  const published = await db.first({
    id: draft._id,
    status: 'published',
    select: Entry.title
  })
  test.is(published, 'Draft')
})

test('drafts and seeds may have invalid fields', async () => {
  const db = await createDb()
  const draft = await db.create({
    type: Article,
    root: 'pages',
    status: 'draft',
    set: {title: 'Draft'}
  })
  test.is(draft.summary, undefined)
  await db.mutate([
    {
      op: 'create',
      id: 'seeded',
      type: 'Article',
      locale: null,
      root: 'pages',
      fromSeed: 'seeded',
      data: {title: 'Seeded'}
    }
  ])
  const seeded = await db.first({id: 'seeded', select: Entry.title})
  test.is(seeded, 'Seeded')
})
