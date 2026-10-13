import type {Locator, Page} from 'playwright'
import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

// Entries with a preview open the entry sidebar by default, which these tests
// resize; entries without one start with it closed

function divider(page: Page, side: 'left' | 'right') {
  return page.locator(
    `[data-side="${side}"] > .split-view > .sash-container > .sash`
  )
}

async function drag(page: Page, sash: Locator, offset: number) {
  const bounds = await sash.boundingBox()
  if (!bounds) throw new Error('Sidebar divider is not visible')
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + offset, y, {steps: 12})
  await page.mouse.up()
}

function pane(page: Page, side: 'left' | 'right') {
  const panes = page.locator(
    `[data-side="${side}"] > .split-view > .split-view-container > .split-view-view`
  )
  return side === 'left' ? panes.first() : panes.last()
}

async function width(element: Locator) {
  return element.evaluate(element => element.getBoundingClientRect().width)
}

test('resizes both sidebars and preserves widths through navigation and toggling', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() =>
    mount(<DashboardScenarioMount slowPreview />)
  )
  const left = pane(app.page, 'left')
  const right = pane(app.page, 'right')
  await expect.poll(() => width(left)).toBe(320)
  await expect.poll(() => width(right)).toBe(320)

  await drag(app.page, divider(app.page, 'left'), 60)
  await expect.poll(() => width(left)).toBe(380)
  await drag(app.page, divider(app.page, 'right'), -80)
  await expect.poll(() => width(right)).toBe(400)
  await expect.poll(() => width(left)).toBe(380)

  await app.openEntry('Beta')
  await expect.poll(() => width(left)).toBe(380)
  await expect.poll(() => width(right)).toBe(400)

  await app.page
    .getByRole('button', {name: 'Close entry sidebar'})
    .first()
    .click()
  await expect(divider(app.page, 'right')).toHaveCount(0)
  await app.page.getByRole('button', {name: 'Open entry sidebar'}).click()
  await expect.poll(() => width(right)).toBe(400)

  await divider(app.page, 'right').dblclick()
  await expect.poll(() => width(right)).toBe(320)
  await divider(app.page, 'left').dblclick()
  await expect.poll(() => width(left)).toBe(320)

  await drag(app.page, divider(app.page, 'left'), 1000)
  await expect.poll(() => width(left)).toBe(480)
  await drag(app.page, divider(app.page, 'left'), -1000)
  await expect.poll(() => width(left)).toBe(200)
  await app.page.setViewportSize({width: 769, height: 800})
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    )
    .toBe(true)
})

test('restores the saved sidebar width after navigating away and back while closed', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() =>
    mount(<DashboardScenarioMount slowPreview />)
  )
  const right = pane(app.page, 'right')
  await expect.poll(() => width(right)).toBe(320)
  await drag(app.page, divider(app.page, 'right'), -80)
  await expect.poll(() => width(right)).toBe(400)
  await app.page
    .getByRole('button', {name: 'Close entry sidebar'})
    .first()
    .click()
  await expect(divider(app.page, 'right')).toHaveCount(0)
  await app.page.getByRole('button', {name: 'Back to root'}).click()
  await expect(app.page.locator('[data-side="right"]')).toHaveCount(0)
  await app.openEntry('Alpha')
  await expect(divider(app.page, 'right')).toHaveCount(0)
  await app.page.getByRole('button', {name: 'Open entry sidebar'}).click()
  await expect.poll(() => width(right)).toBe(400)
  await expect(
    app.page.getByRole('tablist', {name: 'Entry sidebar'})
  ).toBeVisible()
})

test('keeps mobile panels usable and the editor mounted across breakpoints', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() =>
    mount(<DashboardScenarioMount slowPreview />)
  )
  await app.field('Title').evaluate(element => {
    element.dataset.resizingMarker = 'preserved'
  })
  await app.page.setViewportSize({width: 390, height: 844})
  await expect(divider(app.page, 'left')).toHaveCount(0)
  await expect.poll(() => width(pane(app.page, 'right'))).toBe(390)
  await app.page.getByRole('button', {name: 'Close entry sidebar'}).click()
  await expect(app.field('Title')).toBeVisible()
  await expect(app.field('Title')).toHaveAttribute(
    'data-resizing-marker',
    'preserved'
  )
  await app.page.getByRole('button', {name: 'Open entry sidebar'}).click()
  await expect.poll(() => width(pane(app.page, 'right'))).toBe(390)
  await app.page.setViewportSize({width: 1280, height: 800})
  await expect
    .poll(() => width(pane(app.page, 'left')))
    .toBeGreaterThanOrEqual(200)
  await expect
    .poll(() => width(pane(app.page, 'right')))
    .toBeGreaterThanOrEqual(300)
  await expect(app.field('Title')).toHaveAttribute(
    'data-resizing-marker',
    'preserved'
  )
})
