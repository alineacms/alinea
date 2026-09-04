import type {Locator, Page} from 'playwright'
import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

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
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
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
  await expect(right).toBeHidden()
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

test('keeps mobile panels usable and the editor mounted across breakpoints', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  await app.field('Title').evaluate(element => {
    element.dataset.resizingMarker = 'preserved'
  })
  await app.page.setViewportSize({width: 390, height: 844})
  await expect(pane(app.page, 'left')).toBeHidden()
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

test('keeps all entry sidebar labels and controls inside its minimum width', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  await drag(app.page, divider(app.page, 'right'), 1000)
  const right = pane(app.page, 'right')
  await expect.poll(() => width(right)).toBe(300)
  const close = app.page.getByRole('button', {name: 'Close entry sidebar'})
  await expect(close).toBeVisible()
  const panelBounds = await right.boundingBox()
  const buttonBounds = await close.boundingBox()
  if (!panelBounds || !buttonBounds) throw new Error('Sidebar is not visible')
  expect(buttonBounds.x + buttonBounds.width).toBeLessThanOrEqual(
    panelBounds.x + panelBounds.width
  )
  const tabs = app.page.getByRole('tablist', {name: 'Entry sidebar'})
  const labelsFit = () =>
    tabs.evaluate(element => {
      const viewport = element.parentElement!
      const bounds = viewport.getBoundingClientRect()
      return (
        viewport.scrollWidth <= viewport.clientWidth &&
        [...element.querySelectorAll('[role="tab"]')].every(tab => {
          const label = tab.getBoundingClientRect()
          return label.left >= bounds.left && label.right <= bounds.right
        })
      )
    })
  await expect.poll(labelsFit).toBe(true)

  await app.page.setViewportSize({width: 769, height: 800})
  await expect.poll(labelsFit).toBe(true)
  await expect.poll(() => width(right)).toBeGreaterThanOrEqual(300)
})

test('opens on mobile and keeps panels usable after desktop constraints', async ({
  dashboard,
  mount,
  page
}) => {
  await page.setViewportSize({width: 390, height: 844})
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  await expect(pane(page, 'left')).toBeHidden()
  await expect(pane(page, 'right')).toBeHidden()
  await expect(app.field('Title')).toBeVisible()
  await page.getByRole('button', {name: 'Open entry sidebar'}).click()
  await expect.poll(() => width(pane(page, 'right'))).toBe(390)
  await page.getByRole('button', {name: 'Close entry sidebar'}).click()
  await page.setViewportSize({width: 1280, height: 800})
  await page.getByRole('button', {name: 'Open entry sidebar'}).click()
  await divider(page, 'left').dblclick()
  await divider(page, 'right').dblclick()
  await expect.poll(() => width(pane(page, 'left'))).toBe(320)
  await expect.poll(() => width(pane(page, 'right'))).toBe(320)
  await drag(page, divider(page, 'left'), 60)
  await drag(page, divider(page, 'right'), -80)
  await expect.poll(() => width(pane(page, 'left'))).toBe(380)
  await expect.poll(() => width(pane(page, 'right'))).toBe(400)
  await page.setViewportSize({width: 769, height: 800})
  await expect.poll(() => width(pane(page, 'left'))).toBeLessThan(380)
  await page.setViewportSize({width: 1280, height: 800})
  await expect.poll(() => width(pane(page, 'left'))).toBeGreaterThanOrEqual(200)
  await expect
    .poll(() => width(pane(page, 'right')))
    .toBeGreaterThanOrEqual(300)
})
