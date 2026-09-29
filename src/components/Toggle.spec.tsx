import {expect, test} from '@playwright/experimental-ct-react'
import {Controlled, Example} from './Toggle.stories.js'

test('toggles the pressed state', async ({mount, page}) => {
  await mount(<Example />)
  const bold = page.getByRole('button', {name: 'Bold'})
  await expect(bold).toHaveAttribute('data-slot', 'toggle')
  await expect(bold).toHaveAttribute('aria-pressed', 'false')
  await bold.click()
  await expect(bold).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Space')
  await expect(bold).toHaveAttribute('aria-pressed', 'false')
  const italic = page.getByRole('button', {name: 'Italic'})
  await expect(italic).toHaveAttribute('aria-pressed', 'true')
  await expect(italic).toHaveAttribute('data-variant', 'outline')
  await expect(page.getByRole('button', {name: 'Disabled'})).toBeDisabled()
})

test('controlled pressed state', async ({mount, page}) => {
  await mount(<Controlled />)
  await expect(page.getByText('Off')).toBeVisible()
  await page.getByRole('button', {name: 'Bold'}).click()
  await expect(page.getByText('On')).toBeVisible()
  await expect(page.getByRole('button', {name: 'Bold'})).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})
