import '#test/react.js'
import {getRoot} from '#/core/Internal.js'
import {Policy} from '#/core/Role.js'
import {localUser} from '#/core/User.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {createDashboardStore} from '#test/DashboardFixture.js'
import {expect, test} from 'bun:test'
import {atom} from 'jotai'
import {createExplorerAtoms} from './explorer.js'
import {hashFromRoute, overviewTabAtom, routeAtom} from './nav.js'
import {
  type OverviewParent,
  overviewFilter,
  pickedTab,
  resolveOverview
} from './overview.js'
import {preloadUserPolicyAtom, userPolicyReadyAtom} from './user.js'

const Product = Config.document('Product', {
  fields: {
    status: Field.text('Status'),
    price: Field.number('Price')
  }
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
              active: {label: 'Active', filter: {status: 'active'}},
              archived: {label: 'Archived', filter: {status: 'archived'}}
            },
            filters: {
              price: {
                label: 'Price',
                options: {cheap: {label: 'Cheap', filter: {price: {lt: 50}}}}
              }
            }
          }
        }),
        other: Config.root('Other', {contains: ['Product']})
      }
    })
  }
})

const products: OverviewParent = {
  kind: 'root',
  data: getRoot(config.workspaces.main.products)
}

test('tabs resolve with the overview', () => {
  const overview = resolveOverview(config, products)
  expect(overview.tabs.map(tab => [tab.key, tab.label])).toEqual([
    ['all', 'All'],
    ['active', 'Active'],
    ['archived', 'Archived']
  ])
  expect(pickedTab(overview, 'archived')?.key).toBe('archived')
  // Unknown tabs fall back to the first
  expect(pickedTab(overview, 'nope')?.key).toBe('all')
  expect(pickedTab(overview, undefined)?.key).toBe('all')
})

test('the filter of the tab combines with the picked filters', () => {
  const overview = resolveOverview(config, products)
  const cheap = {price: {lt: 50}}
  expect(overviewFilter(overview, {})).toBeUndefined()
  expect(overviewFilter(overview, {}, 'all')).toBeUndefined()
  expect(overviewFilter(overview, {}, 'active')).toEqual({status: 'active'})
  expect(overviewFilter(overview, {price: ['cheap']})).toEqual(cheap)
  expect(overviewFilter(overview, {price: ['cheap']}, 'archived')).toEqual({
    and: [{status: 'archived'}, cheap]
  })
})

async function catalogue() {
  const db = new LocalDB(config)
  await db.sync()
  const product = (title: string, status: string, price: number) =>
    db.create({
      type: Product,
      workspace: 'main',
      root: 'products',
      set: {title, status, price}
    })
  await product('Chair', 'active', 120)
  await product('Lamp', 'active', 30)
  await product('Stool', 'archived', 20)
  return db
}

test('explorers list the entries of the selected tab', async () => {
  const store = createDashboardStore(config, await catalogue())
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'products'},
    {rootData: atom(getRoot(config.workspaces.main.products))}
  )
  const titles = async () =>
    (await store.get(explorer.itemsReady(null))).map(item => item.title).sort()
  expect(await titles()).toEqual(['Chair', 'Lamp', 'Stool'])
  let page = await store.get(explorer.pageReady)
  expect(page.tab).toBe('all')
  expect(page.filter).toBeUndefined()
  expect(page.sort.manual).toBe(true)

  store.set(explorer.requestedTab, 'active')
  expect(await titles()).toEqual(['Chair', 'Lamp'])
  page = await store.get(explorer.pageReady)
  expect(page.tab).toBe('active')
  expect(page.filter).toEqual({status: 'active'})
  expect(page.query.filter).toEqual(page.filter)
  // Entries can not be reordered between the hidden ones
  expect(page.sort.manual).toBe(false)

  // The tab combines with the filters and the search terms
  const [price] = (await store.get(explorer.overview)).filters
  store.set(explorer.toggleFilter, price, 'cheap')
  expect(await titles()).toEqual(['Lamp'])
  expect((await store.get(explorer.pageReady)).filter).toEqual({
    and: [{status: 'active'}, {price: {lt: 50}}]
  })
  store.set(explorer.clearFilters)
  store.set(explorer.search, 'chair')
  expect(await titles()).toEqual(['Chair'])
  store.set(explorer.requestedTab, 'archived')
  expect(await titles()).toEqual([])

  // An unknown tab lists the first
  store.set(explorer.search, '')
  store.set(explorer.requestedTab, 'nope')
  expect(await titles()).toEqual(['Chair', 'Lamp', 'Stool'])
  expect((await store.get(explorer.pageReady)).tab).toBe('all')
})

test('explorers without tabs show none', async () => {
  const store = createDashboardStore(config, await catalogue())
  await store.get(userPolicyReadyAtom)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'other'},
    {rootData: atom(getRoot(config.workspaces.main.other))}
  )
  store.set(explorer.requestedTab, 'active')
  const page = await store.get(explorer.pageReady)
  expect(page.tab).toBeUndefined()
  expect(page.filter).toBeUndefined()
})

test('the tab of an overview lives in the url and is remembered', () => {
  const store = createDashboardStore(config, new LocalDB(config))
  store.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
  const tab = overviewTabAtom('main', 'products', null)
  store.set(routeAtom, {workspace: 'main', root: 'products'})
  store.set(tab, 'active')
  expect(store.get(routeAtom).tab).toBe('active')
  expect(hashFromRoute(store.get(routeAtom))).toBe(
    '#/entry/main/products?tab=active'
  )
  expect(store.get(tab)).toBe('active')
  // Returning to the overview restores its tab, next to its sort
  store.set(routeAtom, {workspace: 'main', root: 'other'})
  expect(store.get(routeAtom).tab).toBeUndefined()
  store.set(routeAtom, {workspace: 'main', root: 'products', sort: 'title'})
  expect(store.get(routeAtom)).toMatchObject({sort: 'title', tab: 'active'})
  // A tab in the url wins
  store.set(routeAtom, {workspace: 'main', root: 'products', tab: 'archived'})
  expect(store.get(tab)).toBe('archived')
  // Picking the first tab clears it
  store.set(tab, undefined)
  expect(store.get(routeAtom).tab).toBeUndefined()
  store.set(routeAtom, {workspace: 'main', root: 'other'})
  store.set(routeAtom, {workspace: 'main', root: 'products'})
  expect(store.get(routeAtom).tab).toBeUndefined()
})
