import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {createDashboardStore} from '#test/DashboardFixture.js'
import {act, cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Provider} from 'jotai'
import {userPolicyReadyAtom} from '../atoms/user.js'
import {EntryTable} from './EntryTable.js'

afterEach(cleanup)

const Product = Config.document('Product', {
  fields: {title: Field.text('Title')}
})

const config = Config.create({
  schema: {Product},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {products: Config.root('Products', {contains: ['Product']})}
    })
  }
})

test('the table shows its rows once they are loaded', async () => {
  const db = new LocalDB(config)
  await db.sync()
  await db.create({
    type: Product,
    workspace: 'main',
    root: 'products',
    set: {title: 'Chair'}
  })
  // Rows load in a later task, like they do from the worker, so the content
  // suspends and is retried from scratch
  const find = db.find.bind(db)
  let finds = 0
  const delayedFind: typeof db.find = async query => {
    finds++
    await new Promise(resolve => setTimeout(resolve, 10))
    return find(query)
  }
  Object.assign(db, {find: delayedFind})
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  await act(async () => {
    render(
      <Provider store={store}>
        <EntryTable type={Product} aria-label="Products" />
      </Provider>
    )
  })
  expect(await screen.findByText('Chair')).toBeDefined()
  // The retry reads the rows that were loading instead of loading new ones
  expect(finds).toBe(1)
})
