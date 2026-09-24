import {expect, test} from '@playwright/experimental-ct-react'
import {Example, MinMax} from './ListField.stories.js'

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

test('reopens row actions on the menu after leaving the insert picker', async ({
  mount,
  page
}) => {
  await mount(<Example />)

  const hero = page
    .getByRole('list', {name: 'Sections'})
    .getByRole('listitem')
    .first()
  const actions = page.getByRole('dialog', {name: 'Hero actions'})
  await hero.getByRole('button', {name: 'Hero actions'}).click()
  await actions.getByRole('button', {name: 'Insert after'}).click()
  await expect(actions.getByRole('button', {name: 'Insert after'})).toHaveCount(
    0
  )
  await page.mouse.click(5, 5)
  await expect(actions).toHaveCount(0)

  await hero.getByRole('button', {name: 'Hero actions'}).click()
  await expect(
    actions.getByRole('button', {name: 'Insert after'})
  ).toBeVisible()
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

test('enforces min and max item counts', async ({mount, page}) => {
  await mount(<MinMax />)
  const items = page.getByRole('list', {name: 'Items'})
  const addQuote = items.getByRole('button', {name: 'Quote', exact: true})

  await expect(page.getByText('Add at least 2 items')).toBeVisible()
  await addQuote.click()
  await expect(page.getByText('Add at least 2 items')).toHaveCount(0)
  await addQuote.click()
  await expect(items.getByRole('listitem')).toHaveCount(3)
  await expect(addQuote).toHaveCount(0)

  await items.getByRole('button', {name: 'Quote actions'}).first().click()
  await expect(page.getByRole('button', {name: 'Insert after'})).toHaveCount(0)
  await page.keyboard.press('Escape')

  const maxItems = page.getByRole('textbox', {name: 'Max items'})
  await maxItems.fill('2')
  await maxItems.blur()
  await expect(page.getByText('Add at most 2 items')).toBeVisible()
  await expect(addQuote).toHaveCount(0)

  await maxItems.fill('4')
  await maxItems.blur()
  await expect(page.getByText('Add at most 2 items')).toHaveCount(0)
  await expect(addQuote).toBeVisible()
})

test('folds a single item', async ({mount, page}) => {
  await mount(<Example />)
  const rows = page.getByRole('list', {name: 'Sections'}).getByRole('listitem')
  const hero = rows.first()
  const quote = rows.nth(1)

  await hero.getByRole('button', {name: 'Collapse Hero'}).click()
  await expect(hero.getByRole('textbox')).toHaveCount(0)
  await expect(quote.getByRole('textbox', {name: 'Quote'})).toBeVisible()
  await expect(
    page.getByRole('button', {name: 'Expand all items'}).first()
  ).toBeVisible()

  await hero.getByRole('button', {name: 'Expand Hero'}).click()
  await expect(hero.getByRole('textbox', {name: 'Heading'})).toBeVisible()
})
