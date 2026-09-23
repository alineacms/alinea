import {routes} from './support/VisualRoutes.js'
import {FixtureScenarioMount} from './support/VisualScenarioMount.js'
import {expect, test, themed} from './support/VisualTest.js'

themed(() => {
  test('splash page', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.splash
    })
    await expect(app.page.getByRole('heading', {name: 'Simple'})).toBeVisible()
    await app.shot('splash')
  })

  test('sidebar tree with an expanded folder', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
    await tree.getByRole('button', {name: 'Expand Blog'}).click()
    await expect(tree.getByRole('row', {name: 'Hello world'})).toBeVisible()
    await tree.getByRole('row', {name: 'About'}).hover()
    await app.shot('tree-expanded')
  })

  test('sidebar tree with statuses', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.statusUpdated,
      title: 'Updated draft'
    })
    const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
    await tree.getByRole('button', {name: 'Expand Folder'}).click()
    await expect(tree.getByRole('row', {name: /Child/})).toBeVisible()
    await app.shot('tree-statuses')
  })

  test('sidebar tree with untranslated entries', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.i18n,
      ready: page => page.getByRole('row', {name: 'About', exact: true})
    })
    await app.page.getByRole('row', {name: 'About', exact: true}).click()
    await expect(app.page.getByRole('heading', {level: 1})).toHaveText('About')
    await app.page.getByRole('button', {name: 'Language', exact: true}).click()
    await app.page.getByRole('menuitemradio', {name: /^DE/}).click()
    await app.settle()
    const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
    await expect(tree.getByRole('row').first()).toBeVisible()
    await app.shot('tree-untranslated')
  })

  test('workspace menu', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    await app.page.getByRole('button', {name: 'Simple', exact: true}).click()
    await expect(app.page.getByRole('menu')).toBeVisible()
    await app.page.getByRole('menuitemradio', {name: 'Statuses'}).hover()
    await app.shot('workspace-menu')
  })

  test('locale menu', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.i18n,
      ready: page => page.getByRole('row', {name: 'About', exact: true})
    })
    await app.page.getByRole('row', {name: 'About', exact: true}).click()
    await expect(app.page.getByRole('heading', {level: 1})).toHaveText('About')
    await app.page.getByRole('button', {name: 'Language', exact: true}).click()
    await expect(app.page.getByRole('menu')).toBeVisible()
    await app.shot('locale-menu')
  })

  test('search dialog', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    await app.page.getByRole('button', {name: 'Search entries'}).click()
    const dialog = app.page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await app.shot('search-dialog-empty')
    await dialog
      .getByRole('combobox')
      .or(dialog.getByRole('searchbox'))
      .first()
      .fill('release')
    await expect(dialog.getByText('Release notes').first()).toBeVisible()
    await app.shot('search-dialog-results')
  })

  test('rail tooltip', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const rail = app.page.getByRole('complementary', {name: 'Workspace roots'})
    await app.page.mouse.move(640, 400)
    await rail.getByRole('button', {name: 'Media'}).hover()
    await expect(app.page.getByRole('tooltip')).toBeVisible()
    await app.shot('rail-tooltip')
  })

  test('activity panel', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    await app.page.getByRole('button', {name: 'Content is up to date'}).click()
    await expect(
      app.page.locator('[aria-label="Recent activity"]')
    ).toBeVisible()
    await app.shot('activity-panel')
  })

  test('profile popover', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    await app.page.getByRole('button', {name: 'Local user'}).click()
    await expect(app.page.getByText('Appearance', {exact: true})).toBeVisible()
    await app.shot('profile-popover')
  })
})

test.describe('mobile', () => {
  test.use({viewport: {width: 390, height: 844}})
  themed(() => {
    test('splash page', async ({mount, visual}) => {
      const app = await visual.open(() => mount(<FixtureScenarioMount />), {
        hash: routes.splash
      })
      await expect(
        app.page.getByRole('heading', {name: 'Simple'})
      ).toBeVisible()
      await app.shot('splash')
    })
  })
})
