import {expect, test} from '@playwright/experimental-ct-react'
import {Example} from './ListField.stories.js'

test('keeps the remove control visible beside block row actions', async ({
  mount,
  page
}) => {
  await mount(<Example />)

  const sections = page.getByRole('list', {name: 'Sections'})
  const hero = sections.getByRole('listitem').first()
  await expect(hero.getByRole('button', {name: 'Hero actions'})).toBeVisible()
  await expect(hero.getByRole('button', {name: 'Remove Hero'})).toBeVisible()
  await hero.getByRole('button', {name: 'Hero actions'}).click()
  await expect(
    page
      .getByRole('dialog', {name: 'Hero actions'})
      .getByRole('button', {name: 'Delete'})
  ).toHaveCount(0)
  await page.keyboard.press('Escape')

  await hero.getByRole('button', {name: 'Remove Hero'}).click()
  await expect(sections.getByRole('listitem').first()).toHaveAccessibleName(
    'Quote item 1'
  )
})

test('collapsed lists keep only row headers and restore editors when expanded', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  const hero = page
    .getByRole('list', {name: 'Sections'})
    .getByRole('listitem')
    .first()
  await expect(hero.getByRole('textbox', {name: 'Heading'})).toBeVisible()
  await page.getByRole('button', {name: 'Collapse all items'}).first().click()
  await expect(hero.getByRole('textbox')).toHaveCount(0)
  await expect(hero.getByText('Heading', {exact: true})).toHaveCount(0)
  expect((await hero.boundingBox())!.height).toBeLessThan(80)
  await page.getByRole('button', {name: 'Expand all items'}).first().click()
  await expect(hero.getByRole('textbox', {name: 'Heading'})).toBeVisible()
})
