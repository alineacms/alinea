import {suite} from '@alinea/suite'
import {Config, Query} from 'alinea'
import {createCMS} from 'alinea/core'
import {EntryDB} from '../EntryDB.ts'

const test = suite(import.meta)

const Page = Config.document('Page', {fields: {}})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {
    pages: Config.root('Pages', {
      i18n: {locales: ['en', 'de']},
      children: {
        page1: Config.page({
          type: Page,
          children: {
            sub1: Config.page({type: Page})
          }
        })
      }
    })
  }
})
const cms = createCMS({
  schema: {Page},
  workspaces: {main}
})

test('seeding', async () => {
  const db = new EntryDB(cms.config)
  await db.sync()
  const page1EN = await db.first({
    type: Page,
    locale: 'en',
    path: 'page1'
  })
  test.ok(page1EN)
  const page1DE = await db.first({
    type: Page,
    locale: 'de',
    path: 'page1'
  })
  test.ok(page1DE)
})

test('create entries', async () => {
  const db = new EntryDB(cms.config)
  await test.throws(
    () => db.create({type: Page, set: {title: 'x'}}),
    'Invalid locale'
  )
  await test.throws(
    () => db.create({type: Page, locale: 'x', set: {title: 'x'}}),
    'Invalid locale'
  )
  const page1 = await db.create({
    type: Page,
    locale: 'en',
    set: {title: 'New Page'}
  })
  test.is(page1._index, 'a0')

  // We shouldn't be able to create an entry of the same locale and status
  await test.throws(
    () =>
      db.create({type: Page, id: page1._id, locale: 'en', set: {title: 'x'}}),
    'duplicate entry'
  )

  const page1DE = await db.create({
    id: page1._id,
    type: Page,
    locale: 'de',
    set: {title: 'Neue Seite'}
  })
  test.is(page1DE._index, 'a0')
  const page2 = await db.create({
    type: Page,
    locale: 'de',
    set: {title: 'Neue Seite'}
  })
  test.is(page2._index, 'a1')

  const sub1 = await db.create({
    type: Page,
    locale: 'en',
    parentId: page1._id,
    set: {title: 'Sub Page'}
  })

  const result = await db.get({
    type: Page,
    locale: 'en',
    id: sub1._id,
    select: {
      ...Page,
      parentPath: Query.parent({
        select: Page.path
      })
    }
  })

  test.is(result.parentPath, page1.path)
})
