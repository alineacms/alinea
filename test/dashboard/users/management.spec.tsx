import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('opens user management and searches existing users', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.openUsers()
  await expect(app.page).toHaveURL(/#\/users$/)
  await expect(
    app.page.locator('main > div > aside[aria-label="Users"]')
  ).toBeVisible()
  await expect(app.page.getByRole('row', {name: /Alice Editor/})).toBeVisible()

  await app.page.getByRole('searchbox', {name: 'Search users'}).fill('local')
  await expect(app.page.getByRole('row', {name: /Local user/})).toBeVisible()
  await expect(
    app.page.getByRole('row', {name: /Alice Editor/})
  ).not.toBeVisible()
})

test('creates, edits, and deactivates a user', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  await app.openUsers()

  await app.page.getByRole('button', {name: 'Create user'}).click()
  const createUser = app.page.getByRole('dialog')
  await createUser
    .getByRole('textbox', {name: 'Email'})
    .fill('jane@example.com')
  await createUser.getByRole('textbox', {name: 'Name'}).fill('Jane Writer')
  await createUser.getByRole('button', {name: 'Create user'}).click()
  await expect(
    app.page.getByRole('row', {name: /Jane Writer.*jane@example.com/})
  ).toBeVisible()

  await app.page.getByRole('button', {name: 'Actions for Jane Writer'}).click()
  await app.page.getByRole('menuitem', {name: 'Edit'}).click()
  const editUser = app.page.getByRole('dialog')
  await editUser.getByRole('textbox', {name: 'Name'}).fill('Jane Editor')
  await editUser.getByRole('button', {name: 'Save changes'}).click()
  await expect(
    app.page.getByRole('row', {name: /Jane Editor.*jane@example.com/})
  ).toBeVisible()

  await app.page.getByRole('button', {name: 'Actions for Jane Editor'}).click()
  await app.page.getByRole('menuitem', {name: 'Deactivate account'}).click()
  await app.page
    .getByRole('dialog')
    .getByRole('button', {name: 'Deactivate account'})
    .click()
  await expect(
    app.page.getByRole('row', {name: /jane@example.com/})
  ).not.toBeVisible()
})
