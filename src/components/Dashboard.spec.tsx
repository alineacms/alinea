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
