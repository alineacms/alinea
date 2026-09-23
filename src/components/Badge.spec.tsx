import {expect, test} from '@playwright/experimental-ct-react'
import {Usages} from './Badge.stories.js'

test('badges expose their size and status', async ({mount, page}) => {
  await mount(<Usages />)
  const badges = page.locator('[data-slot="badge"]')
  const shared = badges.filter({hasText: 'Shared'}).first()
  await expect(shared).toHaveAttribute('data-size', 'sm')
  await expect(shared.locator('svg')).toHaveCount(1)
  await expect(badges.filter({hasText: 'Web'})).toHaveAttribute(
    'data-size',
    'sm'
  )
  await expect(badges.filter({hasText: 'Web'}).locator('svg')).toHaveCount(0)

  const published = badges.filter({hasText: 'Published'}).first()
  await expect(published).toHaveAttribute('data-size', 'default')
  await expect(published).toHaveAttribute('data-status', 'published')
  const draft = badges.filter({hasText: 'Draft'})
  await expect(draft).toHaveAttribute('data-status', 'draft')
  const color = (status: string) =>
    badges
      .filter({hasText: status})
      .first()
      .evaluate(element => getComputedStyle(element).color)
  expect(await color('Published')).not.toBe(await color('Draft'))
})

test('long labels truncate', async ({mount, page}) => {
  await mount(<Usages />)
  const label = page
    .locator('[data-slot="badge"]')
    .filter({hasText: 'A very long shared label'})
    .first()
  const box = (await label.boundingBox())!
  expect(box.width).toBeLessThanOrEqual(320)
  await expect(label.locator('span')).toHaveCSS('text-overflow', 'ellipsis')
})
