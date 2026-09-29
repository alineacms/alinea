import {expect, test} from '@playwright/experimental-ct-react'
import {AsChild, Loading} from './Button.stories.js'

test('renders the child element with button styling', async ({mount, page}) => {
  await mount(<AsChild />)
  const link = page.getByRole('link', {name: 'Link styled as a button'})
  await expect(link).toHaveAttribute('data-slot', 'button')
  await expect(link).toHaveAttribute('data-variant', 'outline')
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
