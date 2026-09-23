import {expect, test} from '@playwright/experimental-ct-react'
import {Example, States} from './MultipleSelect.stories.js'

test('selects several values and removes a tag', async ({mount, page}) => {
  await mount(<Example />)
  await expect(page.getByText('Select fruits')).toBeVisible()
  await page.locator('[data-slot="multiple-select-trigger"]').click()
  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible()
  await page.getByRole('option', {name: 'Banana'}).click()
  await page.getByRole('option', {name: 'Cherry'}).click()
  await expect(page.getByTestId('value')).toHaveText('Value: banana, cherry')
  await page.keyboard.press('Escape')
  await expect(listbox).toBeHidden()
  const tags = page.locator('[data-slot="multiple-select-tag"]')
  await expect(tags).toHaveText(['Banana', 'Cherry'])
  await tags
    .filter({hasText: 'Banana'})
    .locator('[data-slot="multiple-select-tag-remove"]')
    .click()
  await expect(page.getByTestId('value')).toHaveText('Value: cherry')
})

test('searches the options', async ({mount, page}) => {
  await mount(<Example />)
  await page.locator('[data-slot="multiple-select-trigger"]').click()
  await page.getByRole('searchbox', {name: 'Search options'}).fill('berry')
  await expect(page.getByRole('option')).toHaveText([
    'Elderberry',
    'Raspberry',
    'Strawberry'
  ])
  await page.getByRole('searchbox', {name: 'Search options'}).fill('zzz')
  await expect(page.getByText('No options')).toBeVisible()
})

test('default, disabled and invalid states', async ({mount, page}) => {
  await mount(<States />)
  const fields = page.locator('[data-slot="multiple-select-trigger"]')
  await expect(
    fields.nth(0).locator('[data-slot="multiple-select-tag"]')
  ).toHaveText(['Apple', 'Banana'])
  await expect(
    fields.nth(1).locator('[data-slot="multiple-select-tag-remove"]')
  ).toHaveCount(0)
  await expect(page.getByText('Select at least one fruit')).toBeVisible()
})

test('the list is as wide as the trigger', async ({mount, page}) => {
  await mount(<Example />)
  const trigger = page.locator('[data-slot="multiple-select-trigger"]')
  await trigger.click()
  const content = page.locator('[data-slot="multiple-select-content"]')
  await expect(content).toBeVisible()
  const triggerBox = await trigger.boundingBox()
  const contentBox = await content.boundingBox()
  expect(
    Math.abs(contentBox!.width - Math.max(240, triggerBox!.width))
  ).toBeLessThanOrEqual(1)
})
