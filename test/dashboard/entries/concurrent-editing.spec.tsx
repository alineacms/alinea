import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

const notice = 'This page is being edited by Alice Editor'

test('passes control when the editor does not answer in time', async ({
  dashboard,
  mount,
  page
}) => {
  await page.clock.install()
  const app = await dashboard.mount(() =>
    mount(<DashboardScenarioMount otherEditor="away" />)
  )
  await expect(page.getByText(notice)).toBeVisible()
  await expect(app.field('Title')).not.toBeEditable()

  await page.getByRole('button', {name: 'Ask to edit'}).click()
  await expect(
    page.getByRole('button', {name: /Waiting for Alice Editor/})
  ).toBeDisabled()

  await page.clock.fastForward(31_000)
  await expect(page.getByText(notice)).toBeHidden()
  await expect(app.field('Title')).toBeEditable()
})

test('tells when the editor declines', async ({dashboard, mount, page}) => {
  await page.clock.install()
  await dashboard.mount(() =>
    mount(<DashboardScenarioMount otherEditor="decline" />)
  )
  await page.getByRole('button', {name: 'Ask to edit'}).click()
  await page.clock.fastForward(16_000)
  await expect(
    page.getByText('Alice Editor declined your request to edit')
  ).toBeVisible()
  await expect(page.getByRole('button', {name: 'Ask to edit'})).toBeEnabled()
})

test('hands over when the editor allows a request', async ({
  dashboard,
  mount,
  page
}) => {
  await page.clock.install()
  const app = await dashboard.mount(() =>
    mount(<DashboardScenarioMount otherEditor="ask" />)
  )
  await expect(app.field('Title')).toBeEditable()
  await page.clock.fastForward(16_000)
  const prompt = page.getByRole('dialog', {
    name: 'Alice Editor asks to edit this page'
  })
  // Alice asked when the dashboard opened the entry
  await expect(prompt).toContainText(/control in 1\d seconds/)
  await prompt.getByRole('button', {name: 'Allow'}).click()
  await expect(page.getByText(notice)).toBeVisible()
  await expect(app.field('Title')).not.toBeEditable()
})

test('offers to discard changes after losing control', async ({
  dashboard,
  mount,
  page
}) => {
  await page.clock.install()
  const app = await dashboard.mount(() =>
    mount(<DashboardScenarioMount otherEditor="ask" />)
  )
  await app.field('Title').fill('Alpha edited')
  await page.clock.fastForward(16_000)
  await expect(
    page.getByRole('dialog', {name: 'Alice Editor asks to edit this page'})
  ).toBeVisible()
  // Nobody answers
  await page.clock.fastForward(31_000)
  const away = page.getByRole('dialog', {
    name: 'While you were away, Alice Editor was given control of this page'
  })
  await away.getByRole('button', {name: 'Discard my changes'}).click()
  await expect(away).toBeHidden()
  await expect(app.field('Title')).toHaveValue('Alpha')
  await expect(page.getByText(notice)).toBeVisible()
})
