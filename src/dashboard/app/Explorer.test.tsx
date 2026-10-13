import {getRoot} from '#/core/Internal.js'
import type {OverviewHeaderProps} from '#/core/Overview.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {createDashboardStore} from '#test/DashboardFixture.js'
import {act, cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {atom, Provider} from 'jotai'
import {createExplorerAtoms} from '../atoms/explorer.js'
import {userPolicyReadyAtom} from '../atoms/user.js'
import {ExplorerBody} from './Explorer.js'

afterEach(cleanup)

function ProductHeader({parentId, filter, query}: OverviewHeaderProps) {
  return (
    <p data-testid="header">
      {JSON.stringify({parentId, filter, root: query.root})}
    </p>
  )
}

const Product = Config.document('Product', {
  fields: {status: Field.text('Status')}
})

const config = Config.create({
  schema: {Product},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        products: Config.root('Products', {
          contains: ['Product'],
          overview: {
            tabs: {
              all: {label: 'All'},
              active: {label: 'Active', filter: {status: 'active'}}
            },
            header: ProductHeader
          }
        })
      }
    })
  }
})

test('the body shows the tabs and the header above the list', async () => {
  const db = new LocalDB(config)
  await db.sync()
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'products'},
    {rootData: atom(getRoot(config.workspaces.main.products))}
  )
  const view = async () => {
    const page = await store.get(explorer.pageReady)
    return (
      <Provider store={store}>
        <ExplorerBody explorer={explorer} page={page} />
      </Provider>
    )
  }
  const rendered = render(await view())
  const header = () => JSON.parse(screen.getByTestId('header').textContent!)
  expect(header()).toEqual({parentId: null, root: 'products'})
  const active = screen.getByRole('tab', {name: 'Active'})
  act(() => fireEvent.click(active))
  expect(store.get(explorer.requestedTab)).toBe('active')
  rendered.rerender(await view())
  expect(active.getAttribute('aria-selected')).toBe('true')
  expect(header()).toEqual({
    parentId: null,
    filter: {status: 'active'},
    root: 'products'
  })
  // The first tab is the default, it is not kept
  act(() => fireEvent.click(screen.getByRole('tab', {name: 'All'})))
  expect(store.get(explorer.requestedTab)).toBeUndefined()
})
