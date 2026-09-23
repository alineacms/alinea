import {expect, test} from '@playwright/experimental-ct-react'
import {Gallery, Labelled, Sizes} from './Icon.stories.js'

test('labelled icons are images, other icons are hidden', async ({
  mount,
  page
}) => {
  await mount(<Labelled />)
  const published = page.getByRole('img', {name: 'Published'})
  await expect(published).toBeVisible()
  await expect(published).not.toHaveAttribute('aria-hidden')
  const decorative = page.getByTestId('decorative')
  await expect(decorative).toHaveAttribute('aria-hidden', 'true')
  await expect(decorative).toHaveAttribute('focusable', 'false')
  await expect(page.getByRole('img')).toHaveCount(1)
})

test('icons scale with the font size', async ({mount, page}) => {
  await mount(<Sizes />)
  const icons = page.locator('svg')
  await expect(icons).toHaveCount(4)
  const small = (await icons.nth(0).boundingBox())!
  const large = (await icons.nth(3).boundingBox())!
  expect(small.width).toBeCloseTo(12, 0)
  expect(large.width).toBeCloseTo(32, 0)
})

test('the gallery renders every dashboard icon', async ({mount, page}) => {
  await mount(<Gallery />)
  await expect(page.getByText('IcRoundSearch', {exact: true})).toBeVisible()
  expect(await page.locator('svg').count()).toBeGreaterThan(100)
})
