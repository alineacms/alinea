import {expect, test} from '@playwright/experimental-ct-react'
import {
  EntryPickerMultiple,
  EntryPickerSingle,
  Example,
  FilePickerSingle,
  FilteredEntryFieldWithoutEntryScope,
  ImagePickerSingle,
  ReadOnly
} from './LinkField.stories.js'

test('opens the standalone image picker story', async ({mount, page}) => {
  await mount(<ImagePickerSingle />)

  await page.getByRole('button', {name: 'Pick an image'}).click()

  await expect(page.getByRole('dialog', {name: 'Pick an image'})).toBeVisible()
  await expect(
    page.getByRole('treegrid', {name: 'Media folders'})
  ).toBeVisible()
  await expect(page.getByRole('searchbox', {name: 'Search'})).toBeFocused()
})

test('shows image results outside an entry scope', async ({mount, page}) => {
  await mount(<Example />)

  const field = page.getByRole('list', {name: 'Hero image'})
  await field.getByRole('button', {name: 'Remove link'}).click()
  await field.getByRole('button', {name: 'Image'}).click()

  const picker = page.getByRole('dialog', {name: 'Pick an image'})
  await expect(
    picker.getByRole('grid', {name: 'Explorer entries'})
  ).toContainText('landscape')
})

test('keeps remove controls visible on single and multiple link rows', async ({
  mount,
  page
}) => {
  await mount(<Example />)

  const heroImage = page.getByRole('list', {name: 'Hero image'})
  await expect(
    heroImage.getByRole('button', {name: 'Remove link'})
  ).toBeVisible()

  const resources = page.getByRole('list', {name: 'Resources'})
  await expect(
    resources.getByRole('button', {name: 'Remove link'})
  ).toHaveCount(3)
  await resources
    .getByRole('listitem')
    .first()
    .getByRole('button', {name: 'Remove link'})
    .click()
  await expect(
    resources.getByRole('button', {name: 'Remove link'})
  ).toHaveCount(2)
})

test('removes a link from its settings sheet', async ({mount, page}) => {
  await mount(<Example />)

  const heroImage = page.getByRole('list', {name: 'Hero image'})
  await heroImage.getByRole('button', {name: 'landscape'}).click()
  const settings = page.getByRole('dialog', {name: 'landscape'})
  await settings.getByRole('button', {name: 'Remove'}).click()
  await expect(settings).toBeHidden()
  await expect(heroImage.getByRole('listitem')).toHaveCount(0)
  await expect(
    heroImage.getByRole('button', {name: 'Image', exact: true})
  ).toBeVisible()
})

test('opens single-link settings from the linked row', async ({
  mount,
  page
}) => {
  await mount(<Example />)

  const relatedLink = page.getByRole('list', {name: 'Related link'})
  // The link names the row, which describes what it does
  const row = relatedLink.getByRole('button', {name: 'Page Home'})
  await expect(row).toHaveAccessibleDescription('Edit link')
  // Buttons only hold phrasing content
  await expect(row.locator('div')).toHaveCount(0)
  // The row and its "…" are one button
  await expect(relatedLink.getByRole('button')).toHaveCount(2)
  await expect(row).toHaveAttribute('aria-expanded', 'false')
  await row.click()

  const settings = page.getByRole('dialog', {name: 'Home'})
  await expect(settings).toBeVisible()
  await expect(settings.getByText('Page', {exact: true})).toBeVisible()
  await expect(settings.getByRole('textbox', {name: 'Label'})).toBeFocused()
  await expect(settings.getByRole('button', {name: 'Open link'})).toBeVisible()
  await expect(
    settings.getByRole('button', {name: 'Replace link'})
  ).toBeVisible()
  await expect(settings.getByRole('button', {name: 'Remove'})).toBeVisible()
  // The open row is highlighted
  await expect(relatedLink.getByRole('listitem')).toHaveAttribute(
    'aria-current',
    'true'
  )
  await expect(row).toHaveAttribute('aria-expanded', 'true')

  // The row toggles the sheet
  await row.click()
  await expect(settings).toBeHidden()
  await expect(relatedLink.getByRole('listitem')).not.toHaveAttribute(
    'aria-current'
  )
  await row.click()
  await expect(settings).toBeVisible()
  await settings.getByRole('button', {name: 'Close link settings'}).click()
  await expect(settings).toBeHidden()
})

test('opens multiple-link settings from the linked row', async ({
  mount,
  page
}) => {
  await mount(<Example />)

  const resources = page.getByRole('list', {name: 'Resources'})
  const firstRow = resources.getByRole('listitem').first()
  const firstLink = firstRow.getByRole('button', {name: 'Page Home'})
  await expect(firstLink).toHaveAccessibleDescription('Edit link')
  await firstLink.click()
  const home = page.getByRole('dialog', {name: 'Home'})
  await expect(home).toBeVisible()
  await expect(home.getByRole('button', {name: 'Open link'})).toBeVisible()
  await expect(firstRow).toHaveAttribute('aria-current', 'true')
  await page.keyboard.press('Escape')
  await expect(home).toBeHidden()
  await expect(firstLink).toBeFocused()

  // One sheet is open at a time
  const secondRow = resources.getByRole('listitem').nth(1)
  await secondRow
    .getByRole('button', {name: 'External link Alinea documentation'})
    .focus()
  await page.keyboard.press('Enter')
  const docs = page.getByRole('dialog', {name: 'Alinea documentation'})
  await expect(docs).toBeVisible()
  await expect(docs.getByRole('textbox', {name: 'Label'})).toBeFocused()
  // The title given in the link picker is the label
  await expect(docs.getByRole('textbox', {name: 'Label'})).toHaveValue(
    'Alinea documentation'
  )
  await expect(docs.getByText('Anchor', {exact: true})).toHaveCount(0)
  await expect(docs.getByRole('textbox', {name: 'URL suffix'})).toHaveCount(0)
  await expect(secondRow).toHaveAttribute('aria-current', 'true')
  await expect(firstRow).not.toHaveAttribute('aria-current')
  // External links open in a new tab
  await page
    .context()
    .route('https://alineacms.com/**', route => route.fulfill({body: ''}))
  const popup = page.waitForEvent('popup')
  await docs.getByRole('button', {name: 'Open link'}).click()
  await expect
    .poll(async () => (await popup).url())
    .toBe('https://alineacms.com/docs')
  await expect(docs).toBeHidden()

  // The fold toggle and remove button keep their own behavior
  await firstRow.getByRole('button', {name: 'Collapse link'}).click()
  await expect(
    firstRow.getByRole('button', {name: 'Expand link'})
  ).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await secondRow
    .getByRole('button', {name: 'External link Alinea documentation'})
    .click()
  await expect(docs).toBeVisible()
  await secondRow.getByRole('button', {name: 'Remove link'}).click()
  await expect(docs).toBeHidden()
  await expect(resources.getByRole('listitem')).toHaveCount(2)

  const relatedEntries = page.getByRole('list', {name: 'Related entries'})
  await relatedEntries.getByRole('button', {name: 'Page Home'}).click()
  await expect(home).toBeVisible()
  await expect(home.getByRole('textbox', {name: 'URL suffix'})).toBeVisible()
})

test('shows read-only link rows without opening their settings', async ({
  mount,
  page
}) => {
  await mount(<ReadOnly />)

  for (const name of ['Read-only link', 'Read-only links']) {
    const field = page.getByRole('list', {name, exact: true})
    await expect(field.getByText('Home', {exact: true})).toBeVisible()
    await expect(
      field.getByRole('button').filter({hasText: 'Home'})
    ).toHaveCount(0)
  }
})

test('switches link picker workspaces and roots', async ({mount, page}) => {
  await mount(<EntryPickerSingle />)
  await page.getByRole('button', {name: 'Pick an entry'}).click()
  await page.getByRole('button', {name: 'Expand entry picker'}).click()

  await page.getByRole('button', {name: 'Simple'}).click()
  await page.getByRole('menuitemradio', {name: 'Deeply nested'}).click()
  await expect(page.getByText('Docs', {exact: true})).toBeVisible()

  await page.getByRole('button', {name: 'Pages'}).click()
  await page.getByRole('menuitemradio', {name: 'Media'}).click()
  await expect(
    page.getByRole('button', {name: 'Media', exact: true})
  ).toBeVisible()

  await page.getByRole('button', {name: 'Deeply nested'}).click()
  await page.getByRole('menuitemradio', {name: 'Simple'}).click()
  await expect(page.getByRole('button', {name: 'Simple'})).toBeVisible()
})

test('only offers media roots when picking a file', async ({mount, page}) => {
  await mount(<FilePickerSingle />)
  await page.getByRole('button', {name: 'Pick a file'}).click()

  const location = page.getByRole('group', {name: 'Explorer location'})
  await expect(location.getByText('Media', {exact: true})).toBeVisible()
  await expect(location.getByRole('button', {name: 'Media'})).toHaveCount(0)

  await location.getByRole('button', {name: 'Simple'}).click()
  await page.getByRole('menuitemradio', {name: 'Many roots'}).click()
  await expect(location.getByRole('button', {name: 'Many roots'})).toBeVisible()
  await expect(location.getByText('Media', {exact: true})).toBeVisible()
  await expect(location.getByRole('button', {name: 'Media'})).toHaveCount(0)
})

test('keeps a link selected while filtering the picker', async ({
  mount,
  page
}) => {
  await mount(<EntryPickerMultiple />)
  await page.getByRole('button', {name: 'Pick entries'}).click()
  await page.getByRole('button', {name: 'Expand entry picker'}).click()

  const search = page.getByRole('searchbox', {name: 'Search'})
  await expect(search).toBeFocused()
  await page.getByRole('row', {name: /^Home /}).click()
  await expect(page.getByText('1 item selected')).toBeVisible()

  await search.fill('About')
  await expect(page.getByText('About', {exact: true})).toBeVisible()
  await expect(page.getByText('1 item selected')).toBeVisible()
})

test('picks a single link in the expanded picker right away', async ({
  mount,
  page
}) => {
  await mount(<EntryPickerSingle />)
  await page.getByRole('button', {name: 'Pick an entry'}).click()
  await page.getByRole('button', {name: 'Expand entry picker'}).click()

  const picker = page.getByRole('dialog', {
    name: 'Pick a link in expanded view'
  })
  const confirmed = page.waitForEvent(
    'console',
    message => message.type() === 'info'
  )
  await picker.getByRole('row', {name: /^Home /}).click()
  await expect(picker).toBeHidden()
  await confirmed
})

test('picks a single image right away', async ({mount, page}) => {
  await mount(<ImagePickerSingle />)
  await page.getByRole('button', {name: 'Pick an image'}).click()

  const picker = page.getByRole('dialog', {name: 'Pick an image'})
  const image = picker
    .getByRole('grid', {name: 'Explorer entries'})
    .getByRole('row')
    .filter({hasText: 'landscape'})
  await image.click()
  await expect(picker).toBeHidden()
})

test('keeps the picker open while picking multiple links', async ({
  mount,
  page
}) => {
  await mount(<EntryPickerMultiple />)
  await page.getByRole('button', {name: 'Pick entries'}).click()
  await page.getByRole('button', {name: 'Expand entry picker'}).click()

  const picker = page.getByRole('dialog', {
    name: 'Pick a link in expanded view'
  })
  await picker.getByRole('row', {name: /^Home /}).click()
  await expect(picker.getByText('1 item selected')).toBeVisible()
  await expect(picker).toBeVisible()
})

test('opens a compact entry picker and selects immediately', async ({
  mount,
  page
}) => {
  await mount(<EntryPickerSingle />)
  await page.evaluate(() => {
    document.documentElement.dataset.partialCompactPickerSeen = 'false'
    const observer = new MutationObserver(() => {
      const picker = document.querySelector(
        '[role="dialog"][aria-label="Pick a link"]'
      )
      const search = picker?.querySelector('[role="searchbox"]')
      const home = Array.from(
        picker?.querySelectorAll('[role="row"]') ?? []
      ).find(row => row.textContent?.includes('Home'))
      if (search && !home)
        document.documentElement.dataset.partialCompactPickerSeen = 'true'
    })
    observer.observe(document.body, {childList: true, subtree: true})
  })
  await page.getByRole('button', {name: 'Pick an entry'}).click()

  const picker = page.getByRole('dialog', {name: 'Pick a link'})
  const search = picker.getByRole('searchbox', {name: 'Search'})
  await expect(picker).toBeVisible()
  const [pickerBox, viewportHeight] = await Promise.all([
    picker.locator('..').boundingBox(),
    page.evaluate(() => window.visualViewport?.height ?? window.innerHeight)
  ])
  expect(pickerBox?.height).toBeLessThanOrEqual(350)
  expect(pickerBox?.height).toBeLessThanOrEqual(viewportHeight - 32)
  await search.fill('No matching entries')
  await expect(picker.getByText('No results found')).toBeVisible()
  expect((await picker.locator('..').boundingBox())?.height).toBe(
    pickerBox?.height
  )
  await search.fill('')
  await expect(search).toBeFocused()
  await expect(
    picker.getByRole('button', {name: 'Expand entry picker'})
  ).toBeVisible()
  await expect(picker.getByLabel('Explorer view')).toHaveCount(0)
  await expect(picker.getByRole('switch', {name: 'All locations'})).toHaveCount(
    0
  )
  await expect(picker.getByRole('button', {name: 'Select'})).toHaveCount(0)
  await expect(picker.getByRole('checkbox')).toHaveCount(0)

  const home = picker.getByRole('row', {name: /^Home /})
  await expect(home.locator('[data-slot="table-row-grid"] > *')).toHaveCount(1)
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.dataset.partialCompactPickerSeen
      )
    )
    .toBe('false')
  await home.click()
  await expect(picker).toBeHidden()
})

test('keeps static picker conditions outside an entry scope', async ({
  mount,
  page
}) => {
  await mount(<FilteredEntryFieldWithoutEntryScope />)
  await page
    .getByRole('list', {name: 'Filtered entry'})
    .getByRole('button', {name: 'Filtered entry'})
    .click()
  await page.getByRole('button', {name: 'Expand entry picker'}).click()

  const picker = page.getByRole('dialog', {
    name: 'Pick a link in expanded view'
  })
  const resultModes = picker.getByRole('radiogroup', {
    name: 'Explorer results'
  })
  await expect(resultModes.getByRole('radio', {name: 'Filtered'})).toBeChecked()
  await expect(resultModes.getByRole('radio', {name: 'Browse'})).toBeDisabled()
})

test('keeps picker copy for generic link fields', async ({mount, page}) => {
  await mount(<Example />)

  const field = page.getByRole('list', {name: 'Resources'})
  await expect(field.getByRole('button', {name: 'Page link'})).toBeVisible()
  await expect(field.getByRole('button', {name: 'Resources'})).toHaveCount(0)
})

test('selects unique entries in one compact picker action', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  const field = page.getByRole('list', {name: 'Related entries'})
  await expect(field.getByText('Home', {exact: true})).toHaveCount(1)

  await field.getByRole('button', {name: 'Related entries'}).click()
  const picker = page.getByRole('dialog', {name: 'Pick a link'})
  const home = picker.getByRole('row', {name: /^Home /})
  await expect(home).toHaveAttribute('aria-selected', 'true')
  await expect(
    picker.getByRole('checkbox', {name: /^Select Home/})
  ).toBeChecked()
  await picker.getByRole('row', {name: /^About /}).click()
  await expect(picker).toBeVisible()
  await expect(picker.getByText('2 items selected')).toBeVisible()
  await picker.getByRole('button', {name: 'Select'}).click()

  await expect(picker).toBeHidden()
  await expect(field.getByText('Home', {exact: true})).toHaveCount(1)
  await expect(field.getByText('About', {exact: true})).toHaveCount(1)
})

test('allows duplicate generic links by default', async ({mount, page}) => {
  await mount(<Example />)
  const field = page.getByRole('list', {name: 'Resources'})
  await expect(field.getByText('Home', {exact: true})).toHaveCount(1)
  await expect(field.getByText('About', {exact: true})).toHaveCount(0)

  await field.getByRole('button', {name: 'Page link'}).click()
  const picker = page.getByRole('dialog', {name: 'Pick a link'})
  const home = picker.getByRole('row', {name: /^Home /})
  await expect(home).not.toHaveAttribute('aria-selected', 'true')
  // Rows that are already linked are highlighted
  await expect(home).toHaveAttribute('data-highlighted', 'true')
  await home.click()
  await picker.getByRole('row', {name: /^About /}).click()
  await expect(picker).toBeVisible()
  await expect(picker.getByText('2 items selected')).toBeVisible()
  await picker.getByRole('button', {name: 'Select'}).click()

  await expect(picker).toBeHidden()
  await expect(field.getByText('Home', {exact: true})).toHaveCount(2)
  await expect(field.getByText('About', {exact: true})).toHaveCount(1)
})

test('expands the compact entry picker into the explorer modal', async ({
  mount,
  page
}) => {
  await mount(<EntryPickerSingle />)
  await page.getByRole('button', {name: 'Pick an entry'}).click()
  const compactSearch = page.getByRole('searchbox', {name: 'Search'})
  await compactSearch.fill('About')
  await expect(page.getByText('About', {exact: true})).toBeVisible()
  await page.getByRole('button', {name: 'Expand entry picker'}).click()

  const expandedPicker = page.getByRole('dialog', {
    name: 'Pick a link in expanded view'
  })
  await expect(expandedPicker).toBeVisible()
  await expect(
    expandedPicker.getByRole('searchbox', {name: 'Search'})
  ).toHaveValue('About')
  await expect(
    page.getByRole('treegrid', {name: 'Explorer entries'})
  ).toBeVisible()
  await expect(page.getByRole('switch', {name: 'All locations'})).toBeVisible()
  await expect(page.getByLabel('Explorer view')).toBeVisible()
  await expect(page.getByRole('button', {name: 'Select'})).toBeVisible()
})

test('centers the compact picker on the entire link field', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  const trigger = page
    .getByRole('list', {name: 'Resources'})
    .getByRole('button', {name: 'Page link'})
  const field = trigger.locator('..')
  await trigger.click()

  const picker = page.getByRole('dialog', {name: 'Pick a link'})
  await expect(picker).toBeVisible()
  await expect
    .poll(async () => {
      const fieldBox = await field.boundingBox()
      const pickerBox = await picker.boundingBox()
      if (!fieldBox || !pickerBox) return Number.POSITIVE_INFINITY
      const fieldCenter = fieldBox.x + fieldBox.width / 2
      const pickerCenter = pickerBox.x + pickerBox.width / 2
      return Math.abs(fieldCenter - pickerCenter)
    })
    .toBeLessThanOrEqual(1)
})

test('truncates long link labels', async ({mount, page}) => {
  await mount(<Example />)
  const label = page.getByText('Alinea documentation', {exact: true})

  const overflow = await label.evaluate(element => {
    element.textContent =
      'Alinea documentation with an intentionally very long navigation label'
    const style = getComputedStyle(element)
    return {
      clipped: element.scrollWidth > element.clientWidth,
      maxWidth: style.maxWidth,
      overflow: style.overflow,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace
    }
  })

  expect(overflow).toEqual({
    clipped: true,
    maxWidth: '240px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  })
})

test('reorders multiple links by dragging the handle', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  const resources = page.getByRole('list', {name: 'Resources'})
  const first = resources.getByRole('listitem', {name: 'Link item 1'})
  const second = resources.getByRole('listitem', {name: 'Link item 2'})
  await expect(second).toContainText('Alinea documentation')
  // Hover the row header to reveal the drag handle
  await second.hover({position: {x: 40, y: 10}})
  await second.getByRole('button', {name: 'Drag link item 2'}).dragTo(first, {
    sourcePosition: {x: 10, y: 6},
    targetPosition: {x: 40, y: 4}
  })
  await expect(
    resources.getByRole('listitem', {name: 'Link item 1'})
  ).toContainText('Alinea documentation')
})

test('reorders multiple links with the keyboard', async ({mount, page}) => {
  await mount(<Example />)
  const resources = page.getByRole('list', {name: 'Resources'})
  const handle = resources.getByRole('button', {name: 'Drag link item 1'})
  await handle.focus()
  await page.keyboard.press('Enter')
  await expect(handle).not.toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(
    resources.getByRole('listitem', {name: 'Link item 1'})
  ).toContainText('Alinea documentation')
  await expect(
    resources.getByRole('button', {name: 'Drag link item 2'})
  ).toBeFocused()
})

test('inserts a link on the border between link rows', async ({
  mount,
  page
}) => {
  await mount(<Example />)
  const links = page.getByRole('list', {name: 'Resources'})
  await expect(
    links.getByRole('button', {name: 'Insert link before link item 1'})
  ).toHaveCount(0)
  const insert = links.getByRole('button', {
    name: 'Insert link before link item 2'
  })
  await insert.hover()
  await insert.click()
  await page
    .getByRole('dialog', {name: 'Insert link before link item 2'})
    .getByRole('button', {name: 'External link'})
    .click()
  const dialog = page.getByRole('dialog', {name: 'External link'})
  await dialog.getByRole('textbox', {name: 'URL'}).fill('https://example.com')
  await dialog.getByRole('textbox', {name: 'Label'}).fill('Inserted')
  await dialog.getByRole('button', {name: 'Add link'}).click()
  await expect(dialog).toBeHidden()
  const rows = links.getByRole('listitem')
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(1)).toContainText('Inserted')
  await expect(rows.nth(2)).toContainText('Alinea documentation')
})
