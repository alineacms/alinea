import {expect, test} from '@playwright/experimental-ct-react'
import {Rules, Submit} from './Form.stories.js'

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

test('shows the errors of the action and keeps the answers', async ({
  mount,
  page
}) => {
  await mount(<Submit />)
  await page.getByRole('radio', {name: 'IT'}).check()
  const device = page.getByRole('textbox', {name: 'Device *'})
  await device.fill('Toaster')
  await page.getByRole('button', {name: 'Send'}).click()
  await expect(page.getByRole('alert')).toHaveText('We do not repair toasters')
  await expect(device).toHaveValue('Toaster')
  await expect(device).toHaveAttribute('aria-invalid', 'true')
  await device.fill('Laptop')
  await page.getByRole('button', {name: 'Send'}).click()
  await expect(page.getByRole('status')).toHaveText(
    'We will look at your Laptop.'
  )
})
