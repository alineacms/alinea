import {expect, test} from '@playwright/experimental-ct-react'
import {AccessDeniedScenarioMount} from '../support/AccessDeniedScenarioMount.js'

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
