import {EditField, useField, type TypeViewProps} from '#/cms.js'
import {LocalDB} from '#/database/LocalDB.js'
import {views} from '#/field/views.js'
import {Config, Field} from '#/index.js'
import {createDashboardStore} from '#test/DashboardFixture.js'
import {act, cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Provider} from 'jotai'
import {entryAtoms} from '../../atoms/entry.js'
import {viewsAtom} from '../../atoms/core.js'
import type {Page} from '../../atoms/nav.js'
import {userPolicyReadyAtom} from '../../atoms/user.js'
import {entryPage} from './EntryPage.js'

afterEach(cleanup)

function ProductView(_: TypeViewProps) {
  const [summary = '', setSummary] = useField(Product.summary)
  return (
    <div data-testid="view">
      <input
        aria-label="Summary"
        value={summary}
        onChange={event => setSummary(event.target.value)}
      />
      <EditField field={Product.price} />
    </div>
  )
}

const Product = Config.document('Product', {
  view: ProductView,
  fields: {
    summary: Field.text('Summary'),
    price: Field.number('Price')
  }
})

const config = Config.create({
  enableDrafts: true,
  schema: {Product},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {products: Config.root('Products', {contains: ['Product']})}
    })
  }
})

async function setup() {
  const db = new LocalDB(config)
  await db.sync()
  const product = await db.create({
    type: Product,
    set: {title: 'Chair', summary: 'Wooden', price: 120}
  })
  const store = createDashboardStore(config, db)
  store.set(viewsAtom, views)
  await store.get(userPolicyReadyAtom)
  const page: Page = {
    type: 'entry',
    workspace: 'main',
    root: 'products',
    entry: product._id,
    locale: null,
    view: undefined
  }
  const content = await entryPage(page, store.get)
  render(<Provider store={store}>{content}</Provider>)
  const entry = await store.get(entryAtoms(product._id))
  const node = await store.get(entry.locales(null).selectedNode)
  return {store, node}
}

test('a type view edits the fields of its entry', async () => {
  const {store, node} = await setup()
  const summary = screen.getByRole('textbox', {name: 'Summary'})
  expect((summary as HTMLInputElement).value).toBe('Wooden')
  act(() => fireEvent.change(summary, {target: {value: 'Oak'}}))
  expect((summary as HTMLInputElement).value).toBe('Oak')
  expect((store.get(node.value) as {summary: string}).summary).toBe('Oak')
  expect(store.get(node.isDirty)).toBe(true)
})

test('a type view renders below the entry header', async () => {
  await setup()
  expect(screen.getByRole('heading', {name: 'Chair'})).toBeDefined()
  const price = screen.getByRole('textbox', {name: 'Price'}) as HTMLInputElement
  expect(price.value).toBe('120')
  expect(screen.getByRole('button', {name: 'Open entry sidebar'})).toBeDefined()
  act(() =>
    fireEvent.change(screen.getByRole('textbox', {name: 'Summary'}), {
      target: {value: 'Oak'}
    })
  )
  expect(screen.getByRole('button', {name: 'Publish'})).toBeDefined()
})
