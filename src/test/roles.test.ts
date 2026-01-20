import {suite} from '@alinea/suite'
import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'
import {Policy} from 'alinea/core/Role.js'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {create} from 'alinea/core/db/Operation.js'

const test = suite(import.meta)

const Page = Config.document('Page', {
  contains: ['Page'],
  fields: {}
})
const SubPage = Config.document('Page', {
  fields: {
    x: Field.text('X')
  }
})
const Restricted = Config.document('Restricted', {
  contains: [SubPage],
  fields: {}
})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {
    pages: Config.root('Pages', {
      children: {
        seeded1: Config.page({
          type: Page
        })
      }
    })
  }
})
const cms = createCMS({
  schema: {Page, Restricted, SubPage},
  workspaces: {main}
})

test('enforce permissions', async () => {
  const db = new LocalDB(cms.config)
  const mutations = await create({
    type: Page,
    root: 'pages',
    workspace: 'main',
    set: {title: 'Test Page'}
  }).task(db)
  await test.throws(() => db.request(mutations, Policy.ALLOW_NONE), 'denied')
})
