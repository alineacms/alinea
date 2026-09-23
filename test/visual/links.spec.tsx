import type {Locator} from 'playwright'
import {routes} from './support/VisualRoutes.js'
import {FixtureScenarioMount} from './support/VisualScenarioMount.js'
import {expect, test, themed} from './support/VisualTest.js'

async function reveal(locator: Locator) {
  await locator.evaluate(element =>
    element.scrollIntoView({block: 'center', inline: 'nearest'})
  )
}

themed(() => {
  test('link field rows', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const resources = app.page.getByRole('list', {name: 'Resources'})
    await reveal(resources)
    await resources.getByRole('listitem').first().hover()
    await app.shot('link-rows')
  })

  test('link settings', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const resources = app.page.getByRole('list', {name: 'Resources'})
    await reveal(resources)
    await resources.getByRole('button', {name: 'Link settings'}).first().click()
    await expect(app.page.getByRole('dialog')).toBeVisible()
    await app.shot('link-settings')
  })

  test('compact link picker', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const related = app.page.getByRole('list', {name: 'Related link'})
    await reveal(related)
    await related.getByRole('button', {name: 'Page link'}).click()
    const picker = app.page.getByRole('dialog', {
      name: 'Pick a link',
      exact: true
    })
    await expect(picker).toBeVisible()
    await expect(picker.getByRole('row').first()).toBeVisible()
    await picker.getByRole('row').nth(1).hover()
    await app.shot('link-picker-compact')
  })

  test('expanded link picker', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const related = app.page.getByRole('list', {name: 'Related link'})
    await reveal(related)
    await related.getByRole('button', {name: 'Page link'}).click()
    await app.page
      .getByRole('dialog', {name: 'Pick a link', exact: true})
      .getByRole('button', {name: 'Expand entry picker'})
      .click()
    const picker = app.page.getByRole('dialog', {
      name: 'Pick a link in expanded view',
      exact: true
    })
    await expect(picker).toBeVisible()
    await expect(picker.getByRole('row').first()).toBeVisible()
    await app.shot('link-picker-table')
    await picker.getByRole('radio', {name: 'Card view'}).click()
    await expect(picker.getByRole('radio', {name: 'Card view'})).toBeChecked()
    await app.shot('link-picker-cards')
  })

  test('file link picker', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const related = app.page.getByRole('list', {name: 'Related link'})
    await reveal(related)
    await related.getByRole('button', {name: 'File'}).click()
    await expect(app.page.getByRole('dialog').first()).toBeVisible()
    await app.shot('link-picker-file')
  })

  test('external link dialog', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.home,
      title: 'Home'
    })
    const related = app.page.getByRole('list', {name: 'Related link'})
    await reveal(related)
    await related.getByRole('button', {name: 'External link'}).click()
    await expect(app.page.getByRole('dialog')).toBeVisible()
    await app.shot('link-external')
  })
})
