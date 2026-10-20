import {expect, test} from '@playwright/experimental-ct-react'
import {Collapsed, Example, Inline} from './ObjectField.stories.js'

test('folds and unfolds the fields from the label', async ({mount, page}) => {
  await mount(<Example />)
  const toggle = page.getByRole('button', {name: 'Address'})
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('textbox', {name: 'Street'})).toHaveValue(
    'Main street 1'
  )
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByText('Where the venue is')).toBeVisible()
  await toggle.click()
  await expect(page.getByRole('textbox', {name: 'City'})).toHaveValue(
    'Brussels'
  )
})

test('starts folded when the object is collapsed', async ({mount, page}) => {
  await mount(<Collapsed />)
  const toggle = page.getByRole('button', {name: 'Address'})
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await toggle.click()
  await expect(page.getByRole('textbox')).toHaveCount(2)
})

test('an inline object has no fold toggle', async ({mount, page}) => {
  await mount(<Inline />)
  await expect(page.getByRole('button', {name: 'Address'})).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(2)
})
