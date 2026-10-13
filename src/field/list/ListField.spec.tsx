import {expect, type MountResult, test} from '@playwright/experimental-ct-react'
import {Collapsed, Example, MinMax} from './ListField.stories.js'

test('keeps the remove control visible beside the settings button', async ({
  mount,
  page
}) => {
  await mount(<Example />)

  const sections = page.getByRole('list', {name: 'Sections'})
  const hero = sections.getByRole('listitem').first()
  const settings = hero.getByRole('button', {name: 'Hero settings'})
  await expect(settings).toBeVisible()
  await expect(hero.getByRole('button', {name: 'Remove Hero'})).toBeVisible()
  await settings.click()
  const sheet = page.getByRole('dialog', {name: 'Hero'})
  await expect(sheet).toBeVisible()
  await expect(settings).toHaveAttribute('aria-expanded', 'true')
  await expect(hero).toHaveAttribute('aria-current', 'true')
  await expect(sheet.getByRole('textbox', {name: 'Label'})).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(settings).toBeFocused()

  await hero.getByRole('button', {name: 'Remove Hero'}).click()
  await expect(sections.getByRole('listitem').first()).toHaveAccessibleName(
    'Quote item 1'
  )
})

test('deletes a row from its settings', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  await sections.getByRole('button', {name: 'Hero settings'}).click()
  const sheet = page.getByRole('dialog', {name: 'Hero'})
  await sheet.getByRole('button', {name: 'Delete'}).click()
  await expect(sheet).toHaveCount(0)
  await expect(sections.getByRole('listitem').first()).toHaveAccessibleName(
    'Quote item 1'
  )
})

test('names the sheet after the row label', async ({mount, page}) => {
  await mount(<Example />)
  const hero = page
    .getByRole('list', {name: 'Sections'})
    .getByRole('listitem')
    .first()
  await hero.getByRole('button', {name: 'Hero settings'}).click()
  const sheet = page.getByRole('dialog', {name: 'Hero'})
  await sheet.getByRole('textbox', {name: 'Label'}).fill('Intro')
  await expect(page.getByRole('dialog', {name: 'Intro'})).toBeVisible()
  await expect(
    page.getByRole('dialog', {name: 'Intro'}).getByRole('textbox', {
      name: 'Anchor'
    })
  ).toHaveValue('intro')
  await expect(page.getByText(/^Link here/)).toHaveCount(0)
  // The label and anchor need no title, the type's settings follow below one
  await expect(page.locator('[data-slot="sheet-section-title"]')).toHaveText([
    'Settings'
  ])
  await expect(hero.getByText('Intro', {exact: true})).toBeVisible()
})

test('shows the settings "…" of a row on hover', async ({mount, page}) => {
  await mount(<Example />)
  const hero = page
    .getByRole('list', {name: 'Sections'})
    .getByRole('listitem')
    .first()
  const more = hero.locator('[data-slot="sortable-list-item-more"]').first()
  await page.mouse.move(0, 0)
  await expect(more).toHaveCSS('opacity', '0')
  await hero.getByRole('button', {name: 'Hero settings'}).hover()
  await expect(more).toHaveCSS('opacity', '1')
  await page.mouse.move(0, 0)
  await expect(more).toHaveCSS('opacity', '0')
  // Stays visible while the settings are open
  await hero.getByRole('button', {name: 'Hero settings'}).click()
  await page.mouse.move(0, 0)
  await expect(more).toHaveCSS('opacity', '1')
})

test('opens the settings from the row title', async ({mount, page}) => {
  await mount(<Example />)
  const hero = page
    .getByRole('list', {name: 'Sections'})
    .getByRole('listitem')
    .first()
  await hero.getByText('Hero', {exact: true}).click()
  await expect(page.getByRole('dialog', {name: 'Hero'})).toBeVisible()
})

test('keeps the sheet open on the moved row', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  await sections.getByRole('button', {name: 'Hero settings'}).click()
  const sheet = page.getByRole('dialog', {name: 'Hero'})
  await sheet.getByRole('button', {name: 'Move down'}).click()
  await expect(sheet).toBeVisible()
  const hero = sections.getByRole('listitem', {name: 'Hero item 2'})
  await expect(hero).toHaveAttribute('aria-current', 'true')
  await sheet.getByRole('button', {name: 'Move up'}).click()
  await expect(sheet).toBeVisible()
  await expect(
    sections.getByRole('listitem', {name: 'Hero item 1'})
  ).toHaveAttribute('aria-current', 'true')
})

test('closes the sheet when focus moves out of it', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  const hero = sections.getByRole('listitem').first()
  const settings = hero.getByRole('button', {name: 'Hero settings'})
  await settings.click()
  const sheet = page.getByRole('dialog', {name: 'Hero'})
  await expect(sheet).toBeVisible()
  // Focus moving within the sheet keeps it open
  await sheet.getByRole('textbox', {name: 'Anchor'}).focus()
  await expect(sheet).toBeVisible()
  const heading = hero.getByRole('textbox', {name: 'Heading'})
  await heading.focus()
  await expect(sheet).toHaveCount(0)
  await expect(heading).toBeFocused()

  // Clicking a part of the page that takes no focus closes it too
  await settings.click()
  await expect(sheet).toBeVisible()
  await page.mouse.click(5, 5)
  await expect(sheet).toHaveCount(0)

  // Another row's trigger switches to its sheet
  await settings.click()
  await sections.getByRole('button', {name: 'Quote settings'}).click()
  await expect(page.getByRole('dialog', {name: 'Quote'})).toBeVisible()
  await expect(sheet).toHaveCount(0)
})

test('closes the sheet on the first focus outside it', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  const hero = page
    .getByRole('list', {name: 'Sections'})
    .getByRole('listitem')
    .first()
  await hero.getByRole('button', {name: 'Hero settings'}).click()
  const sheet = page.getByRole('dialog', {name: 'Hero'})
  await expect(sheet.getByRole('textbox', {name: 'Label'})).toBeFocused()
  await hero.getByRole('textbox', {name: 'Heading'}).click()
  await expect(sheet).toHaveCount(0)
})

test('shows the row actions again after leaving the insert picker', async ({
  mount,
  page
}) => {
  await mount(<Example />)

  const hero = page
    .getByRole('list', {name: 'Sections'})
    .getByRole('listitem')
    .first()
  const sheet = page.getByRole('dialog', {name: 'Hero'})
  await hero.getByRole('button', {name: 'Hero settings'}).click()
  await expect(sheet.getByRole('button', {name: 'Insert before'})).toHaveText(
    'Insert before'
  )
  await sheet.getByRole('button', {name: 'Insert after'}).click()
  await expect(sheet.getByRole('button', {name: 'Insert after'})).toHaveCount(0)
  await sheet.getByRole('button', {name: 'Close block settings'}).click()
  await expect(sheet).toHaveCount(0)

  await hero.getByRole('button', {name: 'Hero settings'}).click()
  await expect(sheet.getByRole('button', {name: 'Insert after'})).toBeVisible()
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

  await items.getByRole('button', {name: 'Quote settings'}).first().click()
  await expect(page.getByRole('button', {name: 'Insert after'})).toBeDisabled()
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

test('expands a folded row when its settings open', async ({mount, page}) => {
  await mount(<Example />)
  const hero = page
    .getByRole('list', {name: 'Sections'})
    .getByRole('listitem')
    .first()

  await hero.getByRole('button', {name: 'Collapse Hero'}).click()
  await expect(hero.getByRole('textbox')).toHaveCount(0)
  await hero.getByRole('button', {name: 'Hero settings'}).click()
  await expect(page.getByRole('dialog', {name: 'Hero'})).toBeVisible()
  await expect(hero.getByRole('textbox', {name: 'Heading'})).toBeVisible()

  // Closing the settings leaves the row open
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', {name: 'Hero'})).toBeHidden()
  await expect(hero.getByRole('textbox', {name: 'Heading'})).toBeVisible()
})

test('starts folded when the list is collapsed', async ({mount, page}) => {
  await mount(<Collapsed />)
  const quotes = page.getByRole('list', {name: 'Quotes'})
  await expect(quotes.getByRole('listitem')).toHaveCount(2)
  await expect(quotes.getByRole('textbox')).toHaveCount(0)
  await expect(
    page.getByRole('button', {name: 'Expand all items'})
  ).toBeVisible()

  // Added rows start open, the others stay folded
  await quotes.getByRole('button', {name: 'Quote', exact: true}).click()
  await expect(quotes.getByRole('listitem')).toHaveCount(3)
  await expect(quotes.getByRole('textbox', {name: 'Quote'})).toHaveCount(1)
})

type Locator = ReturnType<MountResult['locator']>

/** Accessible names of the direct rows of a list */
function rowNames(list: Locator) {
  return list.evaluate(element =>
    Array.from(
      element.querySelectorAll(':scope > [data-slot="sortable-list-item"]')
    ).map(row => row.getAttribute('aria-label'))
  )
}

test('reorders rows by dragging their header', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  const hero = sections.getByRole('listitem', {name: 'Hero item 1'})
  const quote = sections.getByRole('listitem', {name: 'Quote item 2'})
  await hero.getByRole('button', {name: 'Collapse Hero'}).click()
  await quote.getByRole('button', {name: 'Collapse Quote'}).click()
  const header = hero.locator('[data-slot="sortable-list-item-header"]')
  const box = (await header.boundingBox())!
  const quoteBox = (await quote.boundingBox())!
  // Grabbed on the title, which opens the settings on a click
  await page.mouse.move(box.x + 120, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, quoteBox.y + quoteBox.height * 0.75, {
    steps: 8
  })
  await page.mouse.up()
  await expect(sections.getByRole('listitem').first()).toHaveAccessibleName(
    'Quote item 1'
  )
  await expect(
    sections.getByRole('listitem', {name: 'Hero item 2'})
  ).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('reorders rows with the keyboard', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  const settings = sections.getByRole('button', {name: 'Hero settings'})
  await settings.focus()
  await page.keyboard.press('Alt+ArrowDown')
  await expect(sections.getByRole('listitem').first()).toHaveAccessibleName(
    'Quote item 1'
  )
  await expect(settings).toBeFocused()
})

test('keeps nested list moves inside their own list', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  const before = await rowNames(sections)
  const items = page.getByRole('list', {name: 'Items', exact: true})
  await expect(items.getByRole('listitem')).toHaveCount(2)
  await items
    .getByRole('button', {name: / settings$/})
    .first()
    .focus()
  await page.keyboard.press('Alt+ArrowDown')
  await expect(items.getByRole('textbox').first()).toHaveValue(
    'Review responsive layout'
  )
  // The last nested row can not move out of its list
  await page.keyboard.press('Alt+ArrowDown')
  expect(await rowNames(sections)).toEqual(before)
})

test('copies and pastes rows', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  const hero = sections.getByRole('listitem', {name: 'Hero item 1'})
  await hero.getByRole('button', {name: 'Hero settings'}).click()
  const sheet = page.getByRole('dialog', {name: 'Hero'})
  await sheet.getByRole('button', {name: 'Copy'}).click()
  await expect(sheet).toBeHidden()
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

  // Insert before a row through the row settings
  const hero = sections.getByRole('listitem', {name: 'Hero item 1'})
  await hero.getByRole('button', {name: 'Hero settings'}).click()
  const sheet = page.getByRole('dialog', {name: 'Hero'})
  await sheet.getByRole('button', {name: 'Insert before'}).click()
  await expect(
    sheet.getByRole('searchbox', {name: 'Search types'})
  ).toBeFocused()
  await sheet.getByRole('option', {name: 'Quote'}).click()
  await expect(sheet).toBeHidden()
  expect((await rowNames(sections))[0]).toBe('Quote item 1')
})

test('inserts a row on the border between rows', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  const before = await rowNames(sections)
  // The first row inserts on the top border of the list
  await expect(
    sections.getByRole('button', {name: 'Insert before Hero item 1'})
  ).toHaveCount(1)
  const insert = sections.getByRole('button', {
    name: 'Insert before Quote item 2'
  })
  await insert.hover()
  // Waits a moment, so passing over the border doesn't flash the line
  await expect(insert.locator('..')).toHaveCSS('transition-delay', '0.3s')
  await expect(insert.locator('..')).toHaveCSS('opacity', '1')
  await insert.click()
  const picker = page.getByRole('dialog', {name: 'Insert before Quote item 2'})
  await picker.getByRole('searchbox', {name: 'Search types'}).fill('stat')
  await page.keyboard.press('Enter')
  await expect(picker).toBeHidden()
  const after = await rowNames(sections)
  expect(after).toHaveLength(before.length + 1)
  expect(after[1]).toBe('Stat item 2')
})

test('edits the settings of a row in its sheet', async ({mount, page}) => {
  await mount(<Example />)
  const sections = page.getByRole('list', {name: 'Sections'})
  const hero = sections.getByRole('listitem').first()
  await expect(hero.getByRole('textbox', {name: 'Heading'})).toBeVisible()
  // Settings are not part of the row's form
  await expect(
    hero.getByRole('textbox', {name: 'Background color'})
  ).toHaveCount(0)
  await hero.getByRole('button', {name: 'Hero settings'}).click()
  const sheet = page.getByRole('dialog', {name: 'Hero'})
  const background = sheet.getByRole('textbox', {name: 'Background color'})
  await expect(sheet.getByRole('heading', {name: 'Settings'})).toBeVisible()
  await background.fill('Blue')
  await page.keyboard.press('Escape')
  await hero.getByRole('button', {name: 'Hero settings'}).click()
  await expect(background).toHaveValue('Blue')
})
