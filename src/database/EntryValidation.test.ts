import {createCMS, Entry} from '#/core.js'
import {EntryValidationError} from '#/core/db/EntryValidationError.js'
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

async function rejection(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    return error
  }
  return undefined
}

test('updating a published entry with invalid fields is rejected', async () => {
  const db = await createDb()
  const created = await db.create({
    type: Article,
    root: 'pages',
    set: {title: 'Article', summary: 'Summary'}
  })
  const error = await rejection(() =>
    db.update({type: Article, id: created._id, set: {summary: ''}})
  )
  test.ok(error instanceof EntryValidationError)
  test.equal((error as EntryValidationError).info.errors, [
    {path: ['summary'], labels: ['Summary'], message: 'Field is required'}
  ])
  const summary = await db.get({id: created._id, select: Article.summary})
  test.is(summary, 'Summary')
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
