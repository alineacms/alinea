import {suite} from '@alinea/suite'
import {Config, Field} from '#/index.js'
import {createCMS} from '#/core.js'
import {SourceDB} from '#/database/entry/SourceDB.js'

const test = suite(import.meta)

const Page = Config.document('Page', {
  fields: {
    title: Field.text('Title')
  }
})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {
    pages: Config.root('Pages', {
      i18n: {
        locales: ['en', 'fr']
      },
      children: {
        page1: Config.page({type: Page}),
        page2: Config.page({type: Page})
      }
    })
  }
})
const cms = createCMS({
  schema: {Page},
  workspaces: {main}
})

test('seed multiple languages', async () => {
  const db = new SourceDB(cms.config)
  await db.sync()
  const page1EN = await db.get({
    locale: 'en',
    path: 'page1'
  })
  const page1FR = await db.get({
    locale: 'fr',
    path: 'page1'
  })
  test.is(page1EN._id, page1FR._id)
})

test('keeps updated titles when re-indexing multiple seeded translations', async () => {
  const db = new SourceDB(cms.config)
  await db.sync()

  const page1EN = await db.get({locale: 'en', path: 'page1'})
  const page1FR = await db.get({locale: 'fr', path: 'page1'})
  const page2EN = await db.get({locale: 'en', path: 'page2'})
  const page2FR = await db.get({locale: 'fr', path: 'page2'})
  test.is(
    await db.get({id: page1EN._id, locale: 'en', select: Page.title}),
    'page1'
  )
  test.is(
    await db.get({id: page1FR._id, locale: 'fr', select: Page.title}),
    'page1'
  )
  test.is(
    await db.get({id: page2EN._id, locale: 'en', select: Page.title}),
    'page2'
  )
  test.is(
    await db.get({id: page2FR._id, locale: 'fr', select: Page.title}),
    'page2'
  )

  await db.update({
    type: Page,
    id: page1EN._id,
    locale: 'en',
    set: {title: 'Updated title'}
  })

  await db.sync()

  const reindexed = new SourceDB(cms.config, db.source)
  await reindexed.sync()
  const updatedPage1EN = await reindexed.get({
    locale: 'en',
    path: 'page1'
  })
  const updatedPage1FR = await reindexed.get({
    locale: 'fr',
    path: 'page1'
  })
  const reindexedPage2EN = await reindexed.get({locale: 'en', path: 'page2'})
  const reindexedPage2FR = await reindexed.get({locale: 'fr', path: 'page2'})
  test.is(
    await reindexed.get({
      id: updatedPage1EN._id,
      locale: 'en',
      select: Page.title
    }),
    'Updated title'
  )
  test.is(
    await reindexed.get({
      id: updatedPage1FR._id,
      locale: 'fr',
      select: Page.title
    }),
    'page1'
  )
  test.is(
    await reindexed.get({
      id: reindexedPage2EN._id,
      locale: 'en',
      select: Page.title
    }),
    'page2'
  )
  test.is(
    await reindexed.get({
      id: reindexedPage2FR._id,
      locale: 'fr',
      select: Page.title
    }),
    'page2'
  )
})
