import {expect, test} from '@playwright/experimental-ct-react'
import {Example} from './Link.stories.js'

test('renders anchors with variants', async ({mount, page}) => {
  await mount(<Example />)
  const plain = page.getByRole('link', {name: 'Plain link'})
  await expect(plain).toHaveAttribute('href', 'https://alinea.sh')
  await expect(plain).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(plain).toHaveAttribute('data-variant', 'plain')
  await expect(
    page.getByRole('link', {name: 'Underlined link'})
  ).toHaveAttribute('data-variant', 'underline')
})

test('handles clicks', async ({mount, page}) => {
  await mount(<Example />)
  await page.getByRole('link', {name: /Clicked/}).click()
  await expect(page.getByText('Clicked 1 times')).toBeVisible()
})

test('disabled links have no destination', async ({mount, page}) => {
  await mount(<Example />)
  const disabled = page.getByText('Disabled link')
  await expect(disabled).toHaveAttribute('aria-disabled', 'true')
  await expect(disabled).not.toHaveAttribute('href')
})
