import {expect, test} from '@playwright/experimental-ct-react'
import {Headings, Monospace, Paragraphs} from './Typography.stories.js'

test('headings render their element with a matching size', async ({
  mount,
  page
}) => {
  await mount(<Headings />)
  const h1 = page.getByRole('heading', {level: 1})
  await expect(h1).toHaveAttribute('data-size', 'xl')
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'Visual size is independent of the element'
    })
  ).toHaveAttribute('data-size', 'sm')
})

test('text renders paragraphs with colors', async ({mount, page}) => {
  await mount(<Paragraphs />)
  await expect(page.locator('p[data-slot="text"]')).toHaveCount(5)
  await expect(page.getByText('Destructive')).toHaveAttribute(
    'data-color',
    'destructive'
  )
})

test('monospace', async ({mount, page}) => {
  await mount(<Monospace />)
  await expect(page.locator('pre[data-slot="code-block"]')).toContainText(
    "Config.document('Article'"
  )
  await expect(page.locator('kbd')).toHaveCount(3)
  await expect(page.locator('blockquote')).toBeVisible()
})
