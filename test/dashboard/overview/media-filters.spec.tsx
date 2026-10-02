import type {Page} from 'playwright'
import {expect, test} from '../support/DashboardTest.js'
import {OverviewScenarioMount} from '../support/OverviewScenarioMount.js'

async function open(page: Page, hash: string) {
  await page.evaluate(hash => {
    localStorage.removeItem('alinea-dashboard-theme')
    window.history.replaceState(null, '', hash)
  }, hash)
}

function table(page: Page) {
  return page.getByRole('treegrid', {name: 'Explorer entries'})
}

async function titles(page: Page) {
  return table(page)
    .getByRole('row')
    .evaluateAll(rows =>
      rows.map(
        row =>
          row
            .querySelector('[data-slot="table-title-title"]')
            ?.textContent?.trim() ?? ''
      )
    )
}

test('filters the media library to PDFs and sorts it Z–A', async ({
  mount,
  page
}) => {
  await open(page, '#/entry/main/media')
  await mount(<OverviewScenarioMount />)
  await page.getByRole('radio', {name: 'Row view'}).click()
  await expect
    .poll(async () => (await titles(page)).length)
    .toBeGreaterThanOrEqual(5)

  await page.getByRole('button', {name: 'Filter', exact: true}).click()
  const menu = page.getByRole('dialog', {name: 'Filter'})
  const fileType = menu.getByRole('group', {name: 'File type'})
  await fileType.getByRole('button', {name: 'PDF', exact: true}).click()
  await expect(
    fileType.getByRole('button', {name: 'PDF', exact: true})
  ).toHaveAttribute('aria-pressed', 'true')
  // PDFs in either case, the folder stays to browse into
  await expect
    .poll(() => titles(page))
    .toEqual(expect.arrayContaining(['Annual report', 'Letter', 'Archive']))
  await expect.poll(async () => (await titles(page)).length).toBe(3)

  // Picking an order again reverses it
  await page.keyboard.press('Escape')
  await page.getByRole('button', {name: 'Sort', exact: true}).click()
  await page.getByRole('menuitem', {name: 'Title', exact: true}).click()
  await expect(page).toHaveURL(/\?sort=title$/)
  await page.getByRole('button', {name: 'Sort by Title'}).click()
  await page.getByRole('menuitem', {name: /^Title/}).click()
  await expect(page).toHaveURL(/\?sort=-title$/)
  await expect
    .poll(() => titles(page))
    .toEqual(['Letter', 'Archive', 'Annual report'])

  // The filter stays while the editor opens a folder and comes back
  await table(page)
    .getByRole('row', {name: /^Archive/})
    .click()
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Archive')
  await page
    .getByRole('navigation', {name: 'Breadcrumb'})
    .getByRole('button')
    .first()
    .click()
  await expect
    .poll(() => titles(page))
    .toEqual(['Letter', 'Archive', 'Annual report'])
  await page.getByRole('button', {name: 'Filter: PDF'}).click()

  // Several file types match any of them
  await fileType.getByRole('button', {name: 'Documents', exact: true}).click()
  await expect
    .poll(() => titles(page))
    .toEqual(['Notes', 'Letter', 'Archive', 'Annual report'])

  // Reset clears the filters and the order
  await page.keyboard.press('Escape')
  await page.getByRole('button', {name: 'Reset', exact: true}).click()
  await expect(page).not.toHaveURL(/sort=/)
  await expect
    .poll(() => titles(page))
    .toEqual(
      expect.arrayContaining([
        'Photo',
        'Notes',
        'Letter',
        'Archive',
        'Annual report'
      ])
    )
  await expect(page.getByRole('button', {name: 'Reset'})).toHaveCount(0)
})

test('lists the unused media files and deletes them all', async ({
  mount,
  page
}) => {
  await open(page, '#/entry/main/media')
  await mount(<OverviewScenarioMount />)
  await page.getByRole('radio', {name: 'Row view'}).click()
  await expect
    .poll(async () => (await titles(page)).length)
    .toBeGreaterThanOrEqual(5)

  await page.getByRole('button', {name: 'Filter', exact: true}).click()
  const menu = page.getByRole('dialog', {name: 'Filter'})
  await menu
    .getByRole('group', {name: 'Usage'})
    .getByRole('button', {name: 'Unused', exact: true})
    .click()
  // The post links to the photo, the folder stays to browse into
  await expect
    .poll(() => titles(page))
    .toEqual(['Archive', 'Notes', 'Letter', 'Annual report'])
  await menu
    .getByRole('group', {name: 'Show'})
    .getByRole('button', {name: 'Files', exact: true})
    .click()
  await expect
    .poll(() => titles(page))
    .toEqual(['Notes', 'Letter', 'Annual report'])
  await page.keyboard.press('Escape')

  await table(page)
    .getByRole('row', {name: /^Notes/})
    .locator('[data-slot="selection-checkbox"]')
    .click()
  await page.keyboard.press('ControlOrMeta+a')
  const selection = page.getByRole('toolbar', {name: 'Selected entries'})
  await selection.getByRole('button', {name: 'Delete'}).click()
  const dialog = page.getByRole('dialog', {name: 'Delete 3 items'})
  await expect(
    dialog.getByText(
      '3 files will be permanently deleted from the media library'
    )
  ).toBeVisible()
  await dialog.getByRole('button', {name: 'Delete', exact: true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(table(page).getByText('No results found')).toBeVisible()

  await page.getByRole('button', {name: 'Reset', exact: true}).click()
  await expect.poll(() => titles(page)).toEqual(['Archive', 'Photo'])
})
