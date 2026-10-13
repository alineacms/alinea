import {expect, test} from '@playwright/experimental-ct-react'
import {Example} from './Select.stories.js'

test('tokens only apply inside data-alinea-theme', async ({mount, page}) => {
  // A public page that renders components inside a themed element
  await page.evaluate(() =>
    document.documentElement.removeAttribute('data-alinea-theme')
  )
  await mount(
    <div data-alinea-theme="" data-testid="themed">
      <Example />
    </div>
  )
  const token = (selector: string) =>
    page.evaluate(
      selector =>
        getComputedStyle(document.querySelector(selector)!)
          .getPropertyValue('--alinea-bg')
          .trim(),
      selector
    )
  expect(await token('body')).toBe('')
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme
    )
  ).toBe('normal')
  expect(await token('[data-testid="themed"]')).not.toBe('')
  // Popovers render in the body, outside the themed element
  await page.getByRole('button', {name: /Design software/}).click()
  await expect(page.getByRole('listbox')).toBeVisible()
  expect(await token('[data-slot="select-content"]')).not.toBe('')
})
