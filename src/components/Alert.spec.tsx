import {expect, test} from '@playwright/experimental-ct-react'
import {Example} from './Alert.stories.js'

test('announces destructive alerts and reports the others as status', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  await expect(page.getByRole('alert')).toHaveCount(2)
  await expect(page.getByRole('status')).toHaveCount(2)
  const translation = page.getByRole('status', {name: 'Translation'})
  await expect(translation).toHaveAttribute('data-variant', 'default')
  await expect(translation.locator('[data-slot="alert-title"]')).toHaveText(
    'This entry has not been translated yet'
  )
  await expect(
    translation
      .locator('[data-slot="alert-actions"]')
      .getByRole('checkbox', {name: 'Copy from existing translation'})
  ).toBeChecked()
})

test('places the icon next to the text', async ({mount, page}) => {
  await mount(<Example />)
  const alert = page.locator('[data-slot="alert"][data-variant="destructive"]')
  const withIcon = alert.first()
  const icon = await withIcon.locator('svg').first().boundingBox()
  const title = await withIcon
    .locator('[data-slot="alert-title"]')
    .boundingBox()
  expect(icon!.x + icon!.width).toBeLessThan(title!.x)
  const withoutIcon = alert.last()
  await expect(withoutIcon).not.toHaveAttribute('data-icon')
  const box = await withoutIcon.boundingBox()
  const description = await withoutIcon
    .locator('[data-slot="alert-description"]')
    .boundingBox()
  expect(description!.x - box!.x).toBeLessThan(20)
})
