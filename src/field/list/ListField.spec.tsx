import {expect, type MountResult, test} from '@playwright/experimental-ct-react'
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

type Locator = ReturnType<MountResult['locator']>

/** Accessible names of the direct rows of a list */
function rowNames(list: Locator) {
  return list.evaluate(element =>
    Array.from(
      element.querySelectorAll(
        ':scope > [data-slot="sortable-list-item-drop-target"]'
      )
    ).map(row =>
      row.querySelector('[role="listitem"]')!.getAttribute('aria-label')
    )
  )
}

test('reorders rows by dragging the handle', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  const hero = sections.getByRole('listitem', {name: 'Hero item 1'})
  const quote = sections.getByRole('listitem', {name: 'Quote item 2'})
  await hero.getByRole('button', {name: 'Collapse Hero'}).click()
  await quote.getByRole('button', {name: 'Collapse Quote'}).click()
  await hero.hover()
  const quoteBox = (await quote.boundingBox())!
  await hero.getByRole('button', {name: 'Drag Hero item 1'}).dragTo(quote, {
    sourcePosition: {x: 10, y: 6},
    targetPosition: {x: 40, y: quoteBox.height - 4}
  })
  await expect(sections.getByRole('listitem').first()).toHaveAccessibleName(
    'Quote item 1'
  )
  await expect(
    sections.getByRole('listitem', {name: 'Hero item 2'})
  ).toBeVisible()
})

test('reorders rows with the keyboard', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  const handle = sections.getByRole('button', {name: 'Drag Hero item 1'})
  await handle.focus()
  await page.keyboard.press('Enter')
  await expect(handle).not.toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(sections.getByRole('listitem').first()).toHaveAccessibleName(
    'Quote item 1'
  )
  await expect(
    sections.getByRole('button', {name: 'Drag Hero item 2'})
  ).toBeFocused()
})

test('keeps nested list drags inside their own list', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  const before = await rowNames(sections)
  const items = page.getByRole('list', {name: 'Items', exact: true})
  await expect(items.getByRole('listitem')).toHaveCount(2)
  const handle = items.getByRole('button', {name: /^Drag .* item 1$/})
  await handle.focus()
  await page.keyboard.press('Enter')
  await expect(handle).not.toBeFocused()
  // Only the two nested rows are drop targets
  await expect(
    page.locator('[data-slot="sortable-list-item-drop-target"][tabindex="-1"]')
  ).toHaveCount(2)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(items.getByRole('textbox').first()).toHaveValue(
    'Review responsive layout'
  )
  expect(await rowNames(sections)).toEqual(before)
})

test('copies and pastes rows', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  const hero = sections.getByRole('listitem', {name: 'Hero item 1'})
  await hero.getByRole('button', {name: 'Hero actions'}).click()
  await page
    .getByRole('dialog', {name: 'Hero actions'})
    .getByRole('button', {name: 'Copy'})
    .click()
  await expect(page.getByRole('dialog', {name: 'Hero actions'})).toBeHidden()
  const count = (await rowNames(sections)).length
  await sections.getByRole('button', {name: 'Paste Hero'}).last().click()
  expect(await rowNames(sections)).toHaveLength(count + 1)
  expect((await rowNames(sections)).at(-1)).toBe(`Hero item ${count + 1}`)
})

test('adds blocks from the type picker', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  const count = (await rowNames(sections)).length
  await sections.getByRole('button', {name: 'More block types'}).last().click()
  const picker = page.getByRole('dialog', {name: 'More block types'})
  const search = picker.getByRole('searchbox', {name: 'Search types'})
  await expect(search).toBeFocused()
  await search.fill('zzz')
  await expect(picker.getByText('No matching types')).toBeVisible()
  await search.fill('stat')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(picker).toBeHidden()
  expect((await rowNames(sections)).at(-1)).toBe(`Stat item ${count + 1}`)

  // Insert before a row through the row actions
  const hero = sections.getByRole('listitem', {name: 'Hero item 1'})
  await hero.getByRole('button', {name: 'Hero actions'}).click()
  const actions = page.getByRole('dialog', {name: 'Hero actions'})
  await actions.getByRole('button', {name: 'Insert before'}).click()
  await actions.getByRole('option', {name: 'Quote'}).click()
  await expect(actions).toBeHidden()
  expect((await rowNames(sections))[0]).toBe('Quote item 1')
})
