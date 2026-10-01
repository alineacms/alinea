import type {Page} from 'playwright'
import {expect, test} from '../support/DashboardTest.js'
import {dashboardScenarioIds} from '../support/DashboardScenarioData.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

interface HeaderFrame {
  title: string | null
  back: string | null
  list: string
}

/**
 * Records the explorer header and list on every frame, so a header that does
 * not describe the listed location is caught even when it is only shown
 * briefly
 */
async function recordHeader(page: Page) {
  await page.evaluate(() => {
    const frames: Array<HeaderFrame> = []
    const record = () => {
      const main = document.querySelector('main')
      const grid = main?.querySelector('[aria-label="Explorer entries"]')
      if (!main || !grid) return
      const frame = {
        title: main.querySelector('h1')?.textContent ?? null,
        back:
          main
            .querySelector('[data-slot="page-back"]')
            ?.getAttribute('aria-label') ?? null,
        list: grid.textContent ?? ''
      }
      const last = frames.at(-1)
      if (
        last?.title === frame.title &&
        last?.back === frame.back &&
        last?.list === frame.list
      )
        return
      frames.push(frame)
    }
    // Sample painted frames, not mutations: react-aria commits a new
    // virtualizer without rows and sizes it before the frame is painted
    function sample() {
      record()
      requestAnimationFrame(sample)
    }
    sample()
    Object.assign(window, {headerFrames: frames})
  })
  return {
    async frames() {
      return page.evaluate(
        () =>
          (window as unknown as {headerFrames: Array<HeaderFrame>}).headerFrames
      )
    }
  }
}

/** The location a header describes, or why it does not match the list */
function describe(frame: HeaderFrame) {
  if (frame.title === null)
    return frame.back === null && frame.list.includes('Legacy image')
      ? 'root'
      : `root header listing "${frame.list}"`
  if (frame.title === 'Media folder')
    return frame.back === 'Back to root' &&
      frame.list.includes('Nested media folder')
      ? 'folder'
      : `folder header listing "${frame.list}"`
  if (frame.title === 'Nested media folder')
    return frame.back === 'Back to parent entry' &&
      frame.list.includes('Nested media file')
      ? 'nested folder'
      : `nested folder header listing "${frame.list}"`
  return `unexpected header "${frame.title}"`
}

for (const readDelay of [0, 20]) {
  test(`shows the back button and title of every media folder level (read delay ${readDelay}ms)`, async ({
    dashboard,
    mount
  }) => {
    const app = await dashboard.mount(
      () => mount(<DashboardScenarioMount readDelay={readDelay} />),
      {
        routeEntry: dashboardScenarioIds.mediaFolder,
        routeRoot: 'media',
        title: 'Media folder'
      }
    )
    const main = app.page.getByRole('main')
    const tree = main.getByRole('treegrid', {name: 'Content tree'})
    const explorer = main.getByRole('grid', {name: 'Explorer entries'})
    const back = main.locator('[data-slot="page-back"]')
    const header = await recordHeader(app.page)

    async function expectRoot() {
      await expect(app.page).toHaveURL(/#\/entry\/main\/media$/)
      await expect(app.title).toHaveCount(0)
      await expect(back).toHaveCount(0)
      await expect(
        explorer.getByRole('row', {name: 'Legacy image', exact: true})
      ).toBeVisible()
    }
    async function expectFolder() {
      await expect(app.title).toHaveText('Media folder')
      await expect(back).toHaveAccessibleName('Back to root')
      await expect(
        explorer.getByRole('row', {name: 'Nested media folder', exact: true})
      ).toBeVisible()
    }
    async function expectNestedFolder() {
      await expect(app.title).toHaveText('Nested media folder')
      await expect(back).toHaveAccessibleName('Back to parent entry')
      await expect(
        explorer.getByRole('row', {name: 'Nested media file', exact: true})
      ).toBeVisible()
    }

    // Open the levels from the explorer and return with the back button
    await expectFolder()
    await back.click()
    await expectRoot()
    await explorer.getByRole('row', {name: 'Media folder', exact: true}).click()
    await expectFolder()
    await explorer
      .getByRole('row', {name: 'Nested media folder', exact: true})
      .click()
    await expectNestedFolder()
    await back.click()
    await expectFolder()
    await back.click()
    await expectRoot()

    // Open the levels from the sidebar tree
    await tree.getByRole('row', {name: /^Media folder/}).click()
    await expectFolder()
    await tree.getByRole('row', {name: /^Nested media folder/}).click()
    await expectNestedFolder()
    // Collapsing its parent in the tree leaves the page as it is
    await tree.getByRole('button', {name: 'Collapse Media folder'}).click()
    await expect(
      tree.getByRole('row', {name: /^Nested media folder/})
    ).toHaveCount(0)
    await expectNestedFolder()
    await main.getByRole('button', {name: 'Media', exact: true}).click()
    await expectRoot()

    // Return through the browser history
    await app.page.goBack()
    await expectNestedFolder()
    await app.page.goBack()
    await expectFolder()
    await app.page.goForward()
    await expectNestedFolder()

    // Browse rapidly without waiting for each level to load
    await back.click()
    await back.click()
    await explorer.getByRole('row', {name: 'Media folder', exact: true}).click()
    await explorer
      .getByRole('row', {name: 'Nested media folder', exact: true})
      .click()
    await expectNestedFolder()

    const shown = (await header.frames()).map(describe)
    expect(
      shown.filter(
        location =>
          location !== 'root' &&
          location !== 'folder' &&
          location !== 'nested folder'
      )
    ).toEqual([])
  })
}

test('shows the parents of a nested media folder in the move dialog', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    routeEntry: dashboardScenarioIds.nestedMediaFile,
    routeRoot: 'media',
    title: 'Nested media file'
  })

  await app.runEntryAction('Move to…')
  const dialog = app.page.getByRole('dialog', {
    name: 'Move "Nested media file"'
  })
  const location = dialog.getByRole('group', {name: 'Explorer location'})
  const entries = dialog.getByRole('treegrid', {name: 'Explorer entries'})
  await expect(
    entries.getByRole('row', {name: /^Nested media file/})
  ).toBeVisible()
  await expect(
    location.getByRole('button', {name: 'Media folder'})
  ).toBeVisible()
  await expect(
    location.getByText('Nested media folder', {exact: true})
  ).toBeVisible()

  await location.getByRole('button', {name: 'Media folder'}).click()
  await expect(
    entries.getByRole('row', {name: /^Nested media folder/})
  ).toBeVisible()
  await expect(location.getByText('Media folder', {exact: true})).toBeVisible()
  await expect(location.getByText('Nested media folder')).toHaveCount(0)
})
