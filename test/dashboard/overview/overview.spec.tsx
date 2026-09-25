import type {Page} from 'playwright'
import {expect, test} from '../support/DashboardTest.js'
import {
  overviewPhotoPreview,
  overviewScenarioIds as ids
} from '../support/OverviewScenarioData.js'
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

test('shows the columns of the parent overview', async ({mount, page}) => {
  await open(page, '#/entry/main/products')
  await mount(<OverviewScenarioMount />)
  const header = page.locator('[data-slot="table-header"]')
  await expect(header).toContainText('Title')
  for (const column of ['Status', 'Article number', 'Categories', 'Brand', 'Price'])
    await expect(header.getByText(column, {exact: true})).toBeVisible()
  // The article number is placed before the built-in columns
  await expect
    .poll(() =>
      header
        .locator('[data-slot="table-head"]')
        .evaluateAll(cells => cells.map(cell => cell.textContent?.trim()))
    )
    .toEqual(['Title', 'Article number', 'Status', 'Categories', 'Brand', 'Price'])
  // All products share a type and no product stores audit data
  for (const column of ['Type', 'Updated', 'Author'])
    await expect(header.getByText(column, {exact: true})).toHaveCount(0)
  const chair = table(page).getByRole('row', {name: /^Chair/})
  await expect(chair).toContainText('€20.00')
  await expect(chair).toContainText('A-100')
  await expect(chair).toContainText('Zeta')
  // Linked categories, sorted by title
  await expect(
    table(page).getByRole('row', {name: /^Table/})
  ).toHaveAccessibleName(/Chairs, Tables/)
  // Toolbar actions of the overview
  await expect(page.getByRole('button', {name: 'Export products'})).toBeVisible()
})

test('search results show the columns that tell them apart', async ({
  mount,
  page
}) => {
  await open(page, '#/entry/main/products')
  await mount(<OverviewScenarioMount />)
  await page.getByRole('searchbox', {name: 'Search'}).fill('chair')
  await expect(table(page).getByRole('row')).toHaveCount(1)
  await expect(table(page).getByRole('row')).toContainText('Chair')
  const header = page.locator('[data-slot="table-header"]')
  await expect(header.getByText('Price', {exact: true})).toBeVisible()
  // One published product without audit data: no built-in columns
  for (const column of ['Type', 'Status', 'Updated', 'Author'])
    await expect(header.getByText(column, {exact: true})).toHaveCount(0)
})

test('sorts by a column header and keeps the sort in the url', async ({
  mount,
  page
}) => {
  await open(page, '#/entry/main/products')
  await mount(<OverviewScenarioMount />)
  await expect.poll(() => titles(page)).toEqual(['Chair', 'Table', 'Lamp'])
  const list = page.locator('[data-reorderable]')
  await expect(list).toHaveCount(1)

  await page.getByRole('button', {name: 'Price', exact: true}).click()
  await expect(page).toHaveURL(/\?sort=price$/)
  await expect.poll(() => titles(page)).toEqual(['Table', 'Lamp', 'Chair'])
  await expect(page.getByText('Sorted by Price')).toBeVisible()
  // Sorting only changes the view, entries can not be reordered meanwhile
  await expect(list).toHaveCount(0)

  await page.getByRole('button', {name: 'Price', exact: true}).click()
  await expect(page).toHaveURL(/\?sort=-price$/)
  await expect.poll(() => titles(page)).toEqual(['Chair', 'Lamp', 'Table'])

  await page.getByRole('button', {name: 'Reset', exact: true}).click()
  await expect(page).not.toHaveURL(/sort=/)
  await expect.poll(() => titles(page)).toEqual(['Chair', 'Table', 'Lamp'])
  await expect(page.getByText('Sorted by Price')).toHaveCount(0)
  await expect(list).toHaveCount(1)
})

test('opens an overview sorted by the column in its url', async ({
  mount,
  page
}) => {
  await open(page, '#/entry/main/products?sort=brand')
  await mount(<OverviewScenarioMount />)
  // Sorted by the linked brand's title, products without a brand last
  await expect.poll(() => titles(page)).toEqual(['Table', 'Chair', 'Lamp'])
  await expect(
    page.getByRole('button', {name: 'Brand', exact: true})
  ).toHaveAttribute('aria-pressed', 'true')
})

test('keeps the sort when returning to the overview', async ({mount, page}) => {
  await open(page, '#/entry/main/products')
  await mount(<OverviewScenarioMount />)
  await page.getByRole('button', {name: 'Price', exact: true}).click()
  await expect(page).toHaveURL(/\?sort=price$/)
  await table(page).getByRole('row', {name: /^Lamp/}).click()
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Lamp')
  await page.getByRole('button', {name: 'Back to root'}).click()
  await expect(page).toHaveURL(/\?sort=price$/)
  await expect.poll(() => titles(page)).toEqual(['Table', 'Lamp', 'Chair'])
})

test('opens linked entries from a cell', async ({mount, page}) => {
  await open(page, '#/entry/main/products')
  await mount(<OverviewScenarioMount />)
  await table(page)
    .getByRole('row', {name: /^Chair/})
    .getByRole('button', {name: 'Zeta', exact: true})
    .click()
  await expect(page).toHaveURL(new RegExp(`${ids.zeta}$`))
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Zeta')
})

test('lists mixed children with per type columns and card thumbnails', async ({
  mount,
  page
}) => {
  await open(page, `#/entry/main/blog/${ids.blog}`)
  await mount(<OverviewScenarioMount />)
  // The blog overview defaults to cards with the cover as image
  const cards = page.getByRole('grid', {name: 'Explorer entries'})
  await expect(
    cards.locator(`img[src="${overviewPhotoPreview}"]`)
  ).toHaveCount(1)
  await page.getByRole('radio', {name: 'Row view'}).click()
  const header = page.locator('[data-slot="table-header"]')
  await expect(header.getByText('Type', {exact: true})).toBeVisible()
  // Every child is published, so there is no status column
  await expect(header.getByText('Status', {exact: true})).toHaveCount(0)
  // Ordered by the default sort: newest first
  await expect.poll(() => titles(page)).toEqual(['Meetup', 'Post'])
  await expect(
    table(page).getByRole('row', {name: /^Meetup/})
  ).toContainText('Ann')
  await expect(table(page).getByRole('row', {name: /^Post/})).toContainText(
    'Bob'
  )
  await page.getByRole('button', {name: 'Author', exact: true}).click()
  await expect.poll(() => titles(page)).toEqual(['Meetup', 'Post'])
  await page.getByRole('button', {name: 'Author', exact: true}).click()
  await expect.poll(() => titles(page)).toEqual(['Post', 'Meetup'])
})

test('lists media with a preview, dimensions, size and file type', async ({
  mount,
  page
}) => {
  await open(page, '#/entry/main/media')
  await mount(<OverviewScenarioMount />)
  await page.getByRole('radio', {name: 'Row view'}).click()
  const photo = table(page).getByRole('row', {name: /^Photo/})
  await expect(photo).toContainText('1200 × 800 px')
  await expect(photo).toContainText('1.02 kB')
  await expect(photo).toContainText('GIF')
  await expect(photo.locator(`img[src="${overviewPhotoPreview}"]`)).toHaveCount(
    1
  )
})

test('lists the products of a brand with an entry table', async ({
  mount,
  page
}) => {
  await open(page, `#/entry/main/brands/${ids.acme}`)
  await mount(<OverviewScenarioMount />)
  const products = page.getByRole('treegrid', {name: 'Products of this brand'})
  await expect(products.getByRole('row')).toHaveCount(1)
  await expect(products.getByRole('row', {name: /^Table/})).toContainText(
    '€5.00'
  )
  await expect(
    page
      .locator('[data-slot="entry-table"] [data-slot="table-header"]')
      .getByText('Price', {exact: true})
  ).toBeVisible()
  await products
    .getByRole('row', {name: /^Table/})
    .locator('[data-slot="table-title"]')
    .click()
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Table')
})
