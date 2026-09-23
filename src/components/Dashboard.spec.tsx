import {expect, test} from '@playwright/experimental-ct-react'
import {Composition} from './Dashboard.stories.js'

test('dashboard composition', async ({mount, page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  await mount(<Composition />)
  await expect(
    page.getByRole('heading', {name: 'Launching the new platform'})
  ).toBeVisible()

  // Editing marks the entry dirty and enables saving
  const save = page.getByRole('button', {name: 'Save draft'})
  await expect(save).toBeDisabled()
  await page.getByRole('textbox', {name: 'Title'}).fill('Launch day')
  await expect(save).toBeEnabled()

  // Tree navigation
  await page.getByRole('row', {name: 'Meet the team'}).click()
  await expect(page.getByRole('heading', {name: 'Meet the team'})).toBeVisible()

  // Search dialog with a command list
  await page.getByRole('button', {name: 'Search'}).click()
  await page.getByPlaceholder('Search pages…').fill('roadmap')
  await expect(page.getByRole('option')).toHaveCount(1)
  await page.getByRole('option', {name: 'Our roadmap for 2027'}).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  // Overview with table and card layouts
  await page.getByRole('radio', {name: 'Overview'}).click()
  await expect(page.getByRole('treegrid', {name: 'Blog'})).toBeVisible()
  await page.getByRole('radio', {name: 'Cards'}).click()
  await expect(page.getByRole('grid', {name: 'Blog'})).toBeVisible()

  // Create dialog
  await page.getByRole('button', {name: 'Create new'}).click()
  await expect(
    page.getByRole('dialog', {name: 'Create a new page'})
  ).toBeVisible()
  await page.getByRole('button', {name: 'Cancel'}).click()
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('dashboard composition shell', async ({mount, page}) => {
  await page.setViewportSize({width: 1440, height: 900})
  await mount(<Composition />)
  const rail = page.getByRole('complementary', {name: 'Roots'})
  await expect(rail.getByRole('button', {name: 'Pages'})).toHaveAttribute(
    'aria-current',
    'page'
  )
  const sidebar = page.locator('[data-slot="sidebar"][data-side="left"]')
  const width = () =>
    sidebar.evaluate(element => element.getBoundingClientRect().width)
  await expect.poll(width).toBe(280)
  const handle = page.locator('[data-slot="resizable-handle"]').first()
  const bounds = await handle.boundingBox()
  const x = bounds!.x + bounds!.width / 2
  const y = bounds!.y + bounds!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 60, y, {steps: 8})
  await page.mouse.up()
  await expect.poll(width).toBe(340)

  // The entry sidebar can be closed and reopened
  const aside = page.locator('[data-slot="sidebar"][data-side="right"]')
  await expect(aside).toBeVisible()
  await page.getByRole('button', {name: 'Close sidebar'}).click()
  await expect(aside).toHaveCount(0)
  await page.getByRole('button', {name: 'Open sidebar'}).click()
  await expect(aside).toBeVisible()
  await expect.poll(width).toBe(340)
})
