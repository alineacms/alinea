import {expect, test} from 'bun:test'
import {suite} from '@alinea/suite'
import {Config, Query} from 'alinea'
import {createCMS, Entry} from 'alinea/core'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {TestDB} from 'alinea/core/db/TestDB.js'
import {atom, createStore} from 'jotai'
import {hydrate} from './atomic.js'
import {Dashboard} from './Dashboard.js'

const Page = Config.document('Page', {
  contains: ['Page'],
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
  schema: {Page},
  workspaces: {main}
})

test('dashboard', () => {
  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(atom(db), atom(cms.config), atom(db))
  const keys = store.get(dashboard.workspaces)
  expect(keys).toEqual(['main'])

  const main = dashboard.workspace.main
  const rootKeys = store.get(main.roots)
  expect(rootKeys).toEqual(['pages'])

  const label = store.get(main.label)
  expect(label).toEqual('Main')
})
