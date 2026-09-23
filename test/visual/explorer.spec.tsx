import {routes} from './support/VisualRoutes.js'
import {FixtureScenarioMount} from './support/VisualScenarioMount.js'
import {expect, test, themed} from './support/VisualTest.js'
import type {Page} from 'playwright'

function explorer(page: Page) {
  return page.getByRole('searchbox', {name: 'Search'})
}

function explorerTests() {
  test('root explorer table view', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.pages,
      ready: explorer
    })
    await app.shot('root-table')
  })

  test('root explorer card view', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.pages,
      ready: explorer
    })
    await app.page.getByRole('radio', {name: 'Card view'}).click()
    await expect(app.page.getByRole('radio', {name: 'Card view'})).toBeChecked()
    await app.shot('root-cards')
  })

  test('root explorer search results', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.pages,
      ready: explorer
    })
    await app.page.getByRole('searchbox', {name: 'Search'}).fill('home')
    await expect(
      app.page
        .getByRole('treegrid', {name: 'Explorer entries'})
        .getByRole('row')
    ).toHaveCount(1)
    await app.shot('root-search')
  })

  test('root explorer without results', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.pages,
      ready: explorer
    })
    await app.page.getByRole('searchbox', {name: 'Search'}).fill('zzzz')
    await expect(
      app.page.getByText(/no (results|entries)/i).first()
    ).toBeVisible()
    await app.shot('root-no-results')
  })

  test('media card grid', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.media,
      ready: explorer
    })
    await app.shot('media-cards')
  })

  test('many entries table', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.many,
      ready: explorer
    })
    await app.shot('many-table')
  })
}

themed(() => {
  explorerTests()

  test('root explorer filter and sort popover', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.pages,
      ready: explorer
    })
    await app.page.getByRole('button', {name: 'Filter and sort'}).click()
    await expect(app.page.getByRole('dialog')).toBeVisible()
    await app.shot('root-filter-sort')
  })

  test('root explorer selection', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.pages,
      ready: explorer
    })
    const table = app.page.getByRole('treegrid', {name: 'Explorer entries'})
    const first = table.getByRole('row').first()
    await first.hover()
    await first.getByRole('checkbox').click({force: true})
    await expect(first.getByRole('checkbox')).toBeChecked()
    await table.getByRole('row').nth(2).hover()
    await app.shot('root-selection')
  })
})

test.describe('mobile', () => {
  test.use({viewport: {width: 390, height: 844}})
  themed(explorerTests)
})
