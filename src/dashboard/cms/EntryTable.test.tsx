import {IndexEvent} from '#/core/db/IndexEvent.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field, Query} from '#/index.js'
import {createDashboardStore} from '#test/DashboardFixture.js'
import {act, cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Provider} from 'jotai'
import {useEffect, useState} from 'react'
import {eventsAtom} from '../atoms/core.js'
import {shaAtom} from '../atoms/graph.js'
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

/** A database with a product whose queries resolve after the given delay */
async function delayedDb(delay: number) {
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
  const finds = {count: 0}
  const delayedFind: typeof db.find = async query => {
    finds.count++
    await new Promise(resolve => setTimeout(resolve, delay))
    return find(query)
  }
  Object.assign(db, {find: delayedFind})
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  return {store, finds}
}

test('the table shows its rows once they are loaded', async () => {
  const {store, finds} = await delayedDb(10)
  await act(async () => {
    render(
      <Provider store={store}>
        <EntryTable type={Product} aria-label="Products" />
      </Provider>
    )
  })
  expect(await screen.findByText('Chair')).toBeDefined()
  // The retry reads the rows that were loading instead of loading new ones
  expect(finds.count).toBe(1)
})

test('the table shows its rows while content keeps changing', async () => {
  const {store} = await delayedDb(40)
  // Every index event restarts the rows that are loading, so the content
  // must not wait for the latest load
  const unsubscribe = store.sub(shaAtom, () => {})
  const events = store.get(eventsAtom)
  let index = 0
  const interval = setInterval(() => {
    const sha = `sha${index++}`
    events.dispatchEvent(new IndexEvent({op: 'index', sha, ids: []}))
  }, 15)
  try {
    await act(async () => {
      render(
        <Provider store={store}>
          <EntryTable workspace="main" root="products" aria-label="Products" />
        </Provider>
      )
    })
    expect(await screen.findByText('Chair')).toBeDefined()
  } finally {
    clearInterval(interval)
    unsubscribe()
  }
})

function RerenderingTable() {
  const [, setRenders] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setRenders(count => count + 1), 3)
    return () => clearInterval(interval)
  }, [])
  // The overview and filter are new objects on every render
  return (
    <EntryTable
      aria-label="Products"
      workspace="main"
      root="products"
      overview={{sort: {desc: Query.updatedAt}}}
      filter={{title: {is: 'Chair'}}}
    />
  )
}

test('the table keeps its rows when rendered with new options', async () => {
  const {store, finds} = await delayedDb(10)
  await act(async () => {
    render(
      <Provider store={store}>
        <RerenderingTable />
      </Provider>
    )
  })
  expect(await screen.findByText('Chair')).toBeDefined()
  expect(finds.count).toBe(1)
})
