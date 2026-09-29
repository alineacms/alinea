import {expect, test} from '@playwright/experimental-ct-react'
import {Example, Formatted, States} from './NumberField.stories.js'

test('steps, clamps and clears the value', async ({mount, page}) => {
  await mount(<Example />)
  const input = page.getByRole('textbox', {name: 'Cookies'})
  const output = page.getByTestId('cookies')
  await expect(input).toHaveValue('3')
  await page
    .getByRole('button', {name: /Increase/})
    .first()
    .click()
  await expect(output).toHaveText('4')
  await input.fill('42')
  await input.blur()
  await expect(output).toHaveText('10')
  await input.fill('')
  await input.blur()
  await expect(output).toHaveText('null')
  await input.focus()
  await page.keyboard.press('ArrowUp')
  await expect(output).toHaveText('0')
})

test('formats the value', async ({mount, page}) => {
  await mount(<Formatted />)
  await expect(page.getByRole('textbox', {name: 'Amount'})).toHaveValue(/45/)
  await expect(page.getByRole('textbox', {name: 'Discount'})).toHaveValue(
    /25\s?%/
  )
})

test('reflects invalid, disabled and read-only', async ({mount, page}) => {
  await mount(<States />)
  await expect(page.getByRole('textbox', {name: 'Required'})).toHaveAttribute(
    'aria-invalid',
    'true'
  )
  await expect(page.getByRole('alert')).toHaveText('Field cannot be empty.')
  await expect(page.getByRole('textbox', {name: 'Disabled'})).toBeDisabled()
  await expect(page.getByRole('textbox', {name: 'Read-only'})).toHaveAttribute(
    'readonly',
    ''
  )
})
