import {expect, test} from '@playwright/experimental-ct-react'
import {Rules} from './Form.stories.js'

test('rules show and disable inputs as the form is filled in', async ({
  mount,
  page
}) => {
  await mount(<Rules />)
  const device = page.getByRole('textbox', {name: 'Device *'})
  const model = page.getByRole('textbox', {name: 'Model'})
  await expect(device).toHaveCount(0)
  await page.getByRole('radio', {name: 'IT'}).check()
  await expect(device).toBeEnabled()
  await expect(model).toHaveCount(0)
  // A hidden section hides its inputs
  await device.fill('My laptop')
  await expect(model).toBeVisible()
  await page.getByRole('radio', {name: 'HR'}).check()
  await expect(device).toBeDisabled()
  // A disabled input counts as empty, so the section hides again
  await expect(model).toHaveCount(0)
})
