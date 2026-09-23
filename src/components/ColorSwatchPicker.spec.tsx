import {expect, test} from '@playwright/experimental-ct-react'
import {Controlled, Example, Stack} from './ColorSwatchPicker.stories.js'

test('selects a color', async ({mount, page}) => {
  await mount(<Example />)
  const options = page.getByRole('option')
  await expect(options).toHaveCount(6)
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await options.nth(3).click()
  await expect(options.nth(3)).toHaveAttribute('aria-selected', 'true')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'false')
})

test('reports the picked color as a hex string', async ({mount, page}) => {
  await mount(<Controlled />)
  const output = page.getByTestId('selected-color')
  await expect(output).toHaveText('#0088ff')
  await page.getByRole('option').first().click()
  await expect(output).toHaveText(/^#aa0000$/i)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(output).toHaveText(/^#ff8800$/i)
})

test('disabled items cannot be selected', async ({mount, page}) => {
  await mount(<Stack />)
  const disabled = page.getByRole('option').last()
  await expect(disabled).toHaveAttribute('aria-disabled', 'true')
  await disabled.click({force: true})
  await expect(disabled).toHaveAttribute('aria-selected', 'false')
})
