import {expect, test} from '@playwright/experimental-ct-react'
import {Example, Vertical} from './Toolbar.stories.js'

test('buttons and toggle groups in a toolbar', async ({mount, page}) => {
  await mount(<Example />)
  const toolbar = page.getByRole('toolbar', {name: 'Text formatting'})
  await expect(toolbar).toHaveAttribute('data-slot', 'toolbar')
  const undo = page.getByRole('button', {name: 'Undo'})
  await expect(undo).toHaveAttribute('data-slot', 'toolbar-button')
  await undo.click()
  await expect(page.getByText('Actions: undo')).toBeVisible()
  await expect(page.getByRole('button', {name: 'Redo'})).toBeDisabled()

  const bold = page.getByRole('button', {name: 'Bold'})
  await expect(bold).toHaveAttribute('data-slot', 'toolbar-toggle-item')
  await bold.click()
  await expect(bold).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('marks: bold')).toBeVisible()

  await page.getByRole('radio', {name: 'Align center'}).click()
  await expect(page.getByText('align: center')).toBeVisible()
  await expect(page.getByRole('separator')).toHaveCount(3)
})

test('arrow keys move focus between toolbar items', async ({mount, page}) => {
  await mount(<Example />)
  await page.getByRole('button', {name: 'Undo'}).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('button', {name: 'Bold'})).toBeFocused()
})

test('vertical toolbar', async ({mount, page}) => {
  await mount(<Vertical />)
  const toolbar = page.getByRole('toolbar', {name: 'Tools'})
  await expect(toolbar).toHaveAttribute('aria-orientation', 'vertical')
  await page.getByRole('button', {name: 'Undo'}).focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('button', {name: 'Redo'})).toBeFocused()
})
