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
  roots: {
    pages: Config.root('Pages', {
      i18n: {
        locales: ['en', 'fr']
      },
      children: {
        page1: Config.page({
          type: Page
        })
      }
    })
  }
})
const cms = createCMS({
  schema: {Page},
  workspaces: {main}
})

test('seed multiple languages', async () => {
  const db = new LocalDB(cms.config)
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
