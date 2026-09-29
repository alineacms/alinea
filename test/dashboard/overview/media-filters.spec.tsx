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
          row.querySelector('[data-slot="table-title"]')?.textContent?.trim() ??
          ''
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

  await page.getByRole('button', {name: 'Filter and sort'}).click()
  const menu = page.getByRole('dialog', {name: 'Filter and sort'})
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

  await menu.getByRole('button', {name: 'Title Z–A'}).click()
  await expect(page).toHaveURL(/\?sort=-titleDesc$/)
  await expect
    .poll(() => titles(page))
    .toEqual(['Letter', 'Archive', 'Annual report'])
  await expect(page.getByText('Sorted by Title Z–A')).toBeVisible()

  // The filter stays while the editor opens a folder and comes back
  await page.keyboard.press('Escape')
  await table(page)
    .getByRole('row', {name: /^Archive/})
    .click()
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Archive')
  await page.getByRole('button', {name: 'Back to root'}).click()
  await expect
    .poll(() => titles(page))
    .toEqual(['Letter', 'Archive', 'Annual report'])
  await page.getByRole('button', {name: 'Filter and sort'}).click()

  // Several file types match any of them
  await fileType.getByRole('button', {name: 'Documents', exact: true}).click()
  await expect
    .poll(() => titles(page))
    .toEqual(['Notes', 'Letter', 'Archive', 'Annual report'])

  await menu.getByRole('button', {name: 'Clear filters'}).click()
  await expect
    .poll(() => titles(page))
    .toEqual(['Photo', 'Notes', 'Letter', 'Archive', 'Annual report'])
})
