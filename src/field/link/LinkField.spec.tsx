import {expect, test} from '@playwright/experimental-ct-react'
import {
  EntryPickerSingle,
  Example,
  ImagePickerSingle
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

test('keeps a link selected while filtering the picker', async ({
  mount,
  page
}) => {
  await mount(<EntryPickerSingle />)
  await page.getByRole('button', {name: 'Pick an entry'}).click()
  await page.getByRole('button', {name: 'Expand entry picker'}).click()

  const search = page.getByRole('searchbox', {name: 'Search'})
  await expect(search).toBeFocused()
  await page.getByRole('row', {name: /^Home /}).click()
  await expect(page.getByText('1 item selected')).toBeVisible()

  await search.fill('About')
  await expect(page.getByText('About', {exact: true})).toBeVisible()
  await expect(page.getByText('1 item selected')).toBeVisible()
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
  await expect(search).toBeFocused()
  await expect(
    picker.getByRole('button', {name: 'Expand entry picker'})
  ).toBeVisible()
  await expect(picker.getByLabel('Explorer view')).toHaveCount(0)
  await expect(picker.getByRole('switch', {name: 'All locations'})).toHaveCount(
    0
  )
  await expect(picker.getByRole('button', {name: 'Select'})).toHaveCount(0)

  const home = picker.getByRole('row', {name: /^Home /})
  await expect(home.locator('[role="gridcell"] [role="gridcell"]')).toHaveCount(
    2
  )
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
  const trigger = page.getByRole('button', {name: 'Page link'})
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
