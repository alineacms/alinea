import {expect, test} from '@playwright/experimental-ct-react'
import {Example, Navigation} from './Breadcrumbs.stories.js'

test('renders a breadcrumb trail', async ({mount, page}) => {
  await mount(<Example />)
  const nav = page.getByRole('navigation', {name: 'Breadcrumb'})
  await expect(nav).toHaveAttribute('data-slot', 'breadcrumb')
  await expect(nav.getByRole('listitem')).toHaveCount(4)
  await expect(page.getByRole('link', {name: 'Home'})).toHaveAttribute(
    'href',
    '#home'
  )
  const current = page.getByRole('link', {name: 'Breadcrumb'})
  await expect(current).toHaveAttribute('aria-current', 'page')
  await expect(current).toHaveAttribute('aria-disabled', 'true')
})

test('navigates with an asChild link', async ({mount, page}) => {
  await mount(<Navigation />)
  const blog = page.getByRole('button', {name: 'Blog'})
  await expect(blog).toHaveAttribute('data-slot', 'breadcrumb-link')
  await blog.click()
  await expect(page.getByRole('link', {name: 'Blog'})).toHaveAttribute(
    'aria-current',
    'page'
  )
  await expect(page.getByText('Article')).toHaveCount(0)
})
