import {expect, test} from '@playwright/experimental-ct-react'
import {Multiple, Single, Sizes} from './ToggleGroup.stories.js'

test('single selection', async ({mount, page}) => {
  await mount(<Single />)
  const group = page.getByRole('radiogroup', {name: 'Alignment'})
  await expect(group).toHaveAttribute('data-slot', 'toggle-group')
  await expect(group).toHaveAttribute('data-variant', 'outline')
  const left = page.getByRole('radio', {name: 'Left'})
  await expect(left).toHaveAttribute('aria-checked', 'true')
  await expect(left).toHaveAttribute('data-slot', 'toggle-group-item')
  await page.getByRole('radio', {name: 'Center'}).click()
  await expect(page.getByText('Alignment: center')).toBeVisible()
  await expect(left).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('radio', {name: 'Center'}).click()
  await expect(page.getByText('Alignment: none')).toBeVisible()
})

test('multiple selection', async ({mount, page}) => {
  await mount(<Multiple />)
  const italic = page.getByRole('button', {name: 'Italic'})
  await italic.click()
  await expect(italic).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Formatting: bold, italic')).toBeVisible()
  await page.getByRole('button', {name: 'Bold'}).click()
  await expect(page.getByText('Formatting: italic')).toBeVisible()
  await expect(page.getByRole('button', {name: 'Strikethrough'})).toBeDisabled()
})

test('sizes and orientation', async ({mount, page}) => {
  await mount(<Sizes />)
  await expect(page.getByRole('radiogroup', {name: 'Size sm'})).toHaveAttribute(
    'data-size',
    'sm'
  )
  await expect(
    page.getByRole('radio', {name: 'First'}).first()
  ).toHaveAttribute('data-size', 'sm')
  const vertical = page.getByRole('radiogroup', {name: 'Vertical'})
  await expect(vertical).toHaveAttribute('data-orientation', 'vertical')
  await page.getByRole('radio', {name: 'Top'}).focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('radio', {name: 'Bottom'})).toBeFocused()
})
