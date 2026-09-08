import {expect, test} from '@playwright/experimental-ct-react'
import {
  AccessDeniedScenarioMount,
  UserAccessDeniedScenarioMount
} from '../support/AccessDeniedScenarioMount.js'

test('shows a useful fallback when no workspace is readable', async ({
  mount,
  page
}) => {
  const app = await mount(<AccessDeniedScenarioMount />)

  await expect(
    app.getByRole('heading', {name: 'No workspace access'})
  ).toBeVisible()
  await expect(app).toContainText(
    'Your current roles do not grant permission to read any workspace.'
  )
  await expect(page).toHaveTitle('Alinea: No workspace access')
})

test('shows an error when user management is not permitted', async ({
  mount,
  page
}) => {
  await page.evaluate(() => window.history.replaceState(null, '', '#/users'))
  const app = await mount(<UserAccessDeniedScenarioMount />)

  await expect(
    app.getByRole('heading', {name: 'No user management access'})
  ).toBeVisible()
  await expect(app).toContainText(
    'Your current roles do not grant permission to manage users.'
  )
  await expect(page).toHaveTitle('Main: No user management access')
})
