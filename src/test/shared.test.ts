import {suite} from '@alinea/suite'
import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'
import {LocalDB} from 'alinea/core/db/LocalDB'

const test = suite(import.meta)

const Page = Config.document('Page', {
  fields: {
    shareMe: Field.text('This is shared across languages', {
      shared: true
    })
  }
})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {
    pages: Config.root('Pages', {
      i18n: {locales: ['en', 'de']}
    })
  }
})
const cms = createCMS({
  schema: {Page},
  workspaces: {main}
})

test('shared fields', async () => {
  const db = new LocalDB(cms.config)
  const page1EN = await db.create({
    type: Page,
    locale: 'en',
    set: {title: 'Page 1', path: 'page1', shareMe: 'xyz'}
  })
  const page1DE = await db.create({
    id: page1EN._id,
    type: Page,
    locale: 'de',
    set: {title: 'Page 1', path: 'page1'}
  })
  test.is(page1EN._id, page1DE._id)

  test.is(page1EN.shareMe, 'xyz')
  test.is(page1DE.shareMe, 'xyz')

  await db.update({
    id: page1EN._id,
    type: Page,
    locale: 'en',
    set: {shareMe: 'Hello'}
  })

  const page1ENUpdated = await db.get({
    type: Page,
    id: page1EN._id,
    locale: 'en'
  })
  const page1DEUpdated = await db.get({
    type: Page,
    id: page1EN._id,
    locale: 'de'
  })
  test.is(page1ENUpdated.shareMe, 'Hello')
  test.is(page1DEUpdated.shareMe, 'Hello')
})
