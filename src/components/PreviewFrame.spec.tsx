import {expect, test} from '@playwright/experimental-ct-react'
import {Example, Loading, Unavailable} from './PreviewFrame.stories.js'

test('navigates, reloads and opens the preview', async ({mount, page}) => {
  await mount(<Example />)
  const toolbar = page.getByRole('toolbar', {name: 'Preview'})
  await expect(toolbar).toHaveAttribute('data-slot', 'preview-toolbar')
  const frame = page.locator('[data-slot="preview-frame"]')
  const iframe = page.getByTitle('Page preview')
  await expect(iframe).toHaveAttribute('data-slot', 'preview-frame-iframe')
  const body = page.frameLocator('iframe').locator('h1')
  await expect(body).toHaveText('Home')
  await expect(frame.getByRole('progressbar')).toHaveCount(0)

  const back = page.getByRole('button', {name: 'Go back in preview'})
  const forward = page.getByRole('button', {name: 'Go forward in preview'})
  await expect(back).toBeDisabled()
  await forward.click()
  await expect(body).toHaveText('About')
  await expect(page.getByText('Page 2 of 3')).toBeVisible()
  await back.click()
  await expect(body).toHaveText('Home')

  await page.getByRole('button', {name: 'Reload preview'}).click()
  await expect(body).toHaveText('Home')
  await page.getByRole('button', {name: 'Open preview in new tab'}).click()
  await expect(page.getByText('Opened 1 times')).toBeVisible()
})

test('arrow keys move focus between the toolbar buttons', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  await page.getByRole('button', {name: 'Go forward in preview'}).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('button', {name: 'Reload preview'})).toBeFocused()
})

test('shows a message when there is nothing to preview', async ({
  mount,
  page
}) => {
  await mount(<Unavailable />)
  await expect(
    page.locator('[data-slot="preview-frame-unavailable"]')
  ).toHaveText('Preview is currently unavailable.')
  await expect(page.locator('iframe')).toHaveCount(0)
  for (const name of [
    'Go back in preview',
    'Go forward in preview',
    'Reload preview',
    'Open preview in new tab'
  ])
    await expect(page.getByRole('button', {name})).toBeDisabled()
})

test('covers the frame while loading', async ({mount, page}) => {
  await mount(<Loading />)
  await expect(
    page.getByRole('progressbar', {name: 'Loading preview'})
  ).toBeVisible()
  await expect(
    page.locator('[data-slot="preview-frame-unavailable"]')
  ).toHaveCount(0)
})
