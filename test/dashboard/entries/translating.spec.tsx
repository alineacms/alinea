import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('translates an entry without copying and publishes the path it shows', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'localizedStart',
    routeRoot: 'localized:fr',
    title: 'Localized start'
  })
  const path = app.page.getByRole('textbox', {name: /^Path/})
  await expect(
    app.page.getByText('This entry has not been translated yet')
  ).toBeVisible()
  await app.page.getByText('Copy from existing translation').click()
  await expect(app.field('Title')).toHaveValue('')

  await app.field('Title').fill('Test fr')
  await expect(path).toHaveValue('test-fr')
  await expect(path).not.toHaveAttribute('aria-invalid', 'true')

  await app.page.getByRole('button', {name: 'Save translation'}).click()
  await expect(
    app.page.getByText('This entry has not been translated yet')
  ).toHaveCount(0)
  await expect(path).toHaveValue('test-fr')

  await app.page.getByRole('button', {name: 'Publish'}).click()
  await expect(
    app.page.getByRole('dialog', {name: 'Fix invalid fields before publishing'})
  ).toHaveCount(0)
  await expect(
    app.page.locator('header').getByText('Draft', {exact: true})
  ).toHaveCount(0)
  await expect(app.title).toHaveText('Test fr')
  await expect(path).toHaveValue('test-fr')
})

test('keeps a path edited while translating', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'localizedStart',
    routeRoot: 'localized:fr',
    title: 'Localized start'
  })
  const path = app.page.getByRole('textbox', {name: /^Path/})
  await expect(path).toHaveValue('localized-start')
  await expect(path).not.toHaveAttribute('aria-invalid', 'true')

  await app.field('Title').fill('Départ localisé')
  await expect(path).toHaveValue('depart-localise')
  await path.fill('depart')
  await app.field('Title').fill('Départ ville')
  await expect(path).toHaveValue('depart')

  await app.page.getByRole('button', {name: 'Save translation'}).click()
  await expect(
    app.page.getByText('This entry has not been translated yet')
  ).toHaveCount(0)
  await expect(path).toHaveValue('depart')
})
