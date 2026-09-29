import {expect, test} from '@playwright/experimental-ct-react'
import {AsChild, Loading} from './Button.stories.js'

test('renders the child element with button styling', async ({mount, page}) => {
  await mount(<AsChild />)
  const link = page.getByRole('link', {name: 'Link styled as a button'})
  await expect(link).toHaveAttribute('data-slot', 'button')
  await expect(link).toHaveAttribute('data-variant', 'outline')
})

test('a disabled child is not followed or clicked', async ({mount, page}) => {
  await mount(<AsChild />)
  const disabled = page.getByText('Disabled link')
  await expect(disabled).toHaveAttribute('aria-disabled', 'true')
  await expect(disabled).not.toHaveAttribute('href')
  await expect(page.getByRole('link')).toHaveCount(1)
  await disabled.dispatchEvent('click')
  await expect(page.getByTestId('clicks')).toHaveText('0')
})

test('loading buttons are disabled', async ({mount, page}) => {
  await mount(<Loading />)
  await expect(page.getByRole('button', {name: /Publishing/})).toHaveAttribute(
    'data-color',
    'primary'
  )
  await expect(
    page.getByRole('progressbar', {name: 'Loading'}).first()
  ).toBeVisible()
})
