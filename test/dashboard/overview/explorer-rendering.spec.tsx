import type {Page} from 'playwright'
import {expect, test} from '../support/DashboardTest.js'
import {dashboardScenarioIds} from '../support/DashboardScenarioData.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

interface ExplorerFrame {
  title: string | null
  rows: number
}

/** Records the title and number of rows of the explorer on every frame */
async function recordExplorer(page: Page) {
  await page.evaluate(() => {
    const frames: Array<ExplorerFrame> = []
    function record() {
      const main = document.querySelector('main')
      const list = main?.querySelector('[aria-label="Explorer entries"]')
      if (!main || !list) return
      const frame = {
        title: main.querySelector('h1')?.textContent ?? null,
        rows: list.querySelectorAll('[role="row"]').length
      }
      const last = frames.at(-1)
      if (last?.title === frame.title && last?.rows === frame.rows) return
      frames.push(frame)
    }
    // Sample painted frames, not mutations: react-aria commits a new
    // virtualizer without rows and sizes it before the frame is painted
    function sample() {
      record()
      requestAnimationFrame(sample)
    }
    sample()
    Object.assign(window, {explorerFrames: frames})
  })
  return {
    async frames() {
      return page.evaluate(
        () =>
          (window as unknown as {explorerFrames: Array<ExplorerFrame>})
            .explorerFrames
      )
    }
  }
}

test('shows the rows of an overview in the first frame it is shown', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() =>
    mount(<DashboardScenarioMount readDelay={5} />)
  )
  const main = app.page.getByRole('main')
  const explorer = main.getByRole('treegrid', {name: 'Explorer entries'})
  const recorder = await recordExplorer(app.page)

  const crumbs = main.getByRole('navigation', {name: 'Breadcrumb'})

  // From the editor of an entry to the overview of its root
  await crumbs.getByRole('button', {name: 'Pages'}).click()
  await expect(app.title).toHaveText('Pages')
  await expect(explorer.getByRole('row', {name: /^Folder/})).toBeVisible()

  // Between the overviews of the root and a folder
  await explorer.getByRole('row', {name: /^Folder/}).click()
  await expect(app.title).toHaveText('Folder')
  await expect(explorer.getByRole('row', {name: /^Child/})).toBeVisible()
  await crumbs.getByRole('button', {name: 'Pages'}).click()
  await expect(app.title).toHaveText('Pages')
  await expect(explorer.getByRole('row', {name: /^Folder/})).toBeVisible()

  // From the editor of a media file to the overview of its folder
  await app.page.evaluate(id => {
    location.hash = `#/entry/main/media/${id}`
  }, dashboardScenarioIds.nestedMediaFile)
  await expect(app.title).toHaveText('Nested media file')
  await crumbs.getByRole('button', {name: 'Nested media folder'}).click()
  await expect(app.title).toHaveText('Nested media folder')
  await expect(
    main
      .getByRole('grid', {name: 'Explorer entries'})
      .getByRole('row', {name: 'Nested media file', exact: true})
  ).toBeVisible()

  const frames = await recorder.frames()
  expect(frames.length).toBeGreaterThan(1)
  expect(frames.filter(frame => frame.rows === 0)).toEqual([])
})
