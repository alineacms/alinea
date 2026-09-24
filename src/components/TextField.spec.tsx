import {expect, test} from '@playwright/experimental-ct-react'
import {Example, Icons, Multiline, States} from './TextField.stories.js'

test('labels the input and reports its value', async ({mount, page}) => {
  await mount(<Example />)
  const input = page.getByRole('textbox', {name: 'Name'})
  await expect(input).toHaveAttribute('placeholder', 'Your name')
  await input.fill('Ada')
  await expect(page.getByTestId('name')).toHaveText('Ada')
  await expect(page.getByRole('textbox', {name: 'Uncontrolled'})).toHaveValue(
    'Initial name'
  )
  await expect(page.getByText('Shared', {exact: true})).toBeVisible()
  await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email')
  await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password')
})

test('multiline fields render a growing textarea', async ({mount, page}) => {
  await mount(<Multiline />)
  const area = page.getByRole('textbox', {name: 'Grows with its content'})
  await expect(area).toHaveJSProperty('tagName', 'TEXTAREA')
  const before = (await area.boundingBox())!.height
  await area.fill('one\ntwo\nthree\nfour\nfive')
  await expect
    .poll(async () => (await area.boundingBox())!.height)
    .toBeGreaterThan(before)
  await expect(
    page.getByRole('textbox', {name: 'At least four rows'})
  ).toHaveAttribute('rows', '4')
})

test('reflects required, invalid, disabled and read-only', async ({
  mount,
  page
}) => {
  await mount(<States />)
  const username = page.getByRole('textbox', {name: 'Username'})
  await expect(username).toHaveAttribute('aria-invalid', 'true')
  await expect(username).toHaveAttribute('required', '')
  await expect(page.getByRole('alert')).toHaveText('Username already exists')
  await expect(page.getByRole('textbox', {name: 'Disabled'})).toBeDisabled()
  await expect(page.getByRole('textbox', {name: 'Read-only'})).toHaveAttribute(
    'readonly',
    ''
  )
})

test('renders start and end icons inside the input', async ({mount, page}) => {
  await mount(<Icons />)
  const search = page.getByRole('textbox', {name: 'Search'})
  const startIcon = page.locator('[data-slot="text-field-start-icon"]')
  await expect(startIcon).toBeVisible()
  const inputBox = (await search.boundingBox())!
  const iconBox = (await startIcon.boundingBox())!
  expect(iconBox.x).toBeGreaterThan(inputBox.x)
  expect(iconBox.x + iconBox.width).toBeLessThan(inputBox.x + inputBox.width)
  await expect(page.locator('[data-slot="text-field-end-icon"]')).toBeVisible()
})
