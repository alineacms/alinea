import {expect, test} from '../support/DashboardTest.js'
import type {Locator, Page} from 'playwright'
import {dashboardScenarioIds} from '../support/DashboardScenarioData.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('navigates between entries and through browser history', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.openEntry('Beta')
  await expect(app.page).toHaveURL(/workflow-beta\?view=edit$/)

  await app.page.goBack()
  await expect(app.title).toHaveText('Alpha')
  await expect(app.field('Title')).toHaveValue('Alpha')
})

test('keeps the sidebar and editor mounted between entry navigations', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  const title = app.field('Title')
  await tree.evaluate(element => {
    element.dataset.navigationMarker = 'preserved'
  })
  await title.evaluate(element => {
    element.dataset.navigationMarker = 'preserved'
  })

  await app.openEntry('Beta')

  await expect(tree).toHaveAttribute('data-navigation-marker', 'preserved')
  await expect(app.field('Title')).toHaveAttribute(
    'data-navigation-marker',
    'preserved'
  )
})

test('scrolls the entry editor to the top when navigating to a different entry', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const title = app.field('Title')

  const initialScrollTop = await title.evaluate(element => {
    let ancestor = element.parentElement
    while (ancestor && getComputedStyle(ancestor).overflowY !== 'auto') {
      ancestor = ancestor.parentElement
    }
    if (!ancestor) throw new Error('Entry editor scroll container not found')
    ancestor.style.flex = '0 0 40px'
    ancestor.scrollTop = 100
    return ancestor.scrollTop
  })
  expect(initialScrollTop).toBeGreaterThan(0)

  await app.openEntry('Beta')

  await expect
    .poll(() =>
      app.field('Title').evaluate(element => {
        let ancestor = element.parentElement
        while (ancestor && getComputedStyle(ancestor).overflowY !== 'auto') {
          ancestor = ancestor.parentElement
        }
        if (!ancestor)
          throw new Error('Entry editor scroll container not found')
        return ancestor.scrollTop
      })
    )
    .toBe(0)
})

test('selects the sidebar root when navigating back to it', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})

  await expect(tree.getByRole('row', {selected: true})).toHaveText(/Alpha$/)
  await app.crumb('Pages').click()

  await expect(
    app.page.locator('button[aria-current="page"]', {hasText: 'Pages'})
  ).toBeVisible()
  await expect(tree.getByRole('row', {selected: true})).toHaveCount(0)
})

test('shows the loaded entry title on an overview outside the sidebar tree', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'hiddenFolder',
    title: 'Hidden folder'
  })

  await expect(app.title).toHaveText('Hidden folder')
  await expect(app.crumb('Pages')).toBeVisible()
  const editView = app.page.getByRole('radio', {name: 'Edit entry'})
  const overviewView = app.page.getByRole('radio', {name: 'Show overview'})
  await expect(overviewView).toBeChecked()
  await editView.click()
  await expect(editView).toBeChecked()
  await expect(app.title).toHaveText('Hidden folder')
  await overviewView.click()
  await expect(overviewView).toBeChecked()
})

test('keeps localized children when switching a sidebar entry to overview', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'localizedStart',
    routeRoot: 'localized',
    title: 'Localized start'
  })

  await app.openEntry('Localized folder')
  await app.page.getByRole('radio', {name: 'Show overview'}).click()

  const overview = app.page.getByRole('treegrid', {name: 'Explorer entries'})
  await expect(overview.getByText('No results found')).toHaveCount(0)
  await expect(
    overview.getByRole('row', {name: /^Localized child/})
  ).toBeVisible()
})

test('expands and collapses an entry with the sidebar chevron', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  await tree.getByRole('button', {name: 'Expand Folder'}).click()
  await expect(
    tree.getByRole('button', {name: 'Collapse Folder'})
  ).toBeVisible()
  await expect(
    tree.getByRole('row', {name: 'Child', exact: true})
  ).toBeVisible()

  await tree.getByRole('button', {name: 'Collapse Folder'}).click()
  await expect(tree.getByRole('button', {name: 'Expand Folder'})).toBeVisible()

  await tree.getByRole('button', {name: 'Expand Folder'}).click()
  await expect(
    tree.getByRole('button', {name: 'Collapse Folder'})
  ).toBeVisible()
  await expect(
    tree.getByRole('row', {name: 'Child', exact: true})
  ).toBeVisible()
})

test('opens a collapsed entry on its overview from the sidebar', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})

  await tree.getByRole('row', {name: 'Ordered folder'}).click()

  // defaultView: 'overview' opens the children instead of the form
  await expect(app.page).not.toHaveURL(/view=edit/)
  await expect(
    app.page
      .getByRole('treegrid', {name: 'Explorer entries'})
      .getByRole('row', {name: /^Apple/})
  ).toBeVisible()
  // collapsed: true keeps it closed until its arrow is clicked
  await expect(
    tree.getByRole('button', {name: 'Expand Ordered folder'})
  ).toBeVisible()
  await expect(tree.getByRole('row', {name: 'Apple'})).toHaveCount(0)
  await tree.getByRole('button', {name: 'Expand Ordered folder'}).click()
  await expect(tree.getByRole('row', {name: 'Apple'})).toBeVisible()
})

test('orders children by their parent type and keeps them movable', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})

  await tree.getByRole('button', {name: 'Expand Ordered folder'}).click()

  const children = tree.locator('[role="row"][aria-level="2"]')
  await expect(children).toHaveText([/Apple$/, /Zebra$/])
  // They can not be reordered, but can be moved into other entries
  await expect(tree.getByRole('button', {name: 'Drag Apple'})).toBeVisible()
  await expect(tree.getByRole('button', {name: 'Drag Zebra'})).toBeVisible()
})

test('orders a root overview by the root configuration', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const roots = app.page.getByRole('complementary', {name: 'Workspace roots'})

  await roots.getByRole('button', {name: 'Ordered pages'}).click()

  const overview = app.page.getByRole('treegrid', {name: 'Explorer entries'})
  await expect(overview.getByRole('row')).toHaveText([/Apple/, /Zebra/])
})

test('shows the configured root icon in the rail and the splash page', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const roots = app.page.getByRole('complementary', {name: 'Workspace roots'})
  const sidebar = app.page.locator('[data-slot="sidebar"]')
  function icon(button: Locator) {
    return button.locator('svg').first().innerHTML()
  }
  const configured = await icon(
    roots.getByRole('button', {name: 'Ordered pages'})
  )
  const fallback = await icon(roots.getByRole('button', {name: 'Pages'}))
  expect(configured).not.toBe(fallback)

  await roots.getByRole('button', {name: 'Ordered pages'}).click()
  await expect(
    sidebar.getByRole('button', {name: 'Ordered pages'})
  ).toBeVisible()

  await app.page.evaluate(() => {
    window.location.hash = '#/'
  })
  // The splash page has no roots rail, wait for it to replace the entry page
  await expect(roots).toHaveCount(0)
  const splashRoot = app.page.getByRole('button', {
    name: 'Ordered pages',
    exact: true
  })
  await expect(splashRoot).toBeVisible()
  expect(await icon(splashRoot)).toBe(configured)
  // Roots without an icon use the same fallback everywhere
  expect(
    await icon(app.page.getByRole('button', {name: 'Pages', exact: true}))
  ).toBe(fallback)
})

test('lists recently changed media files with their action and author on the splash page', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const roots = app.page.getByRole('complementary', {name: 'Workspace roots'})
  await app.page.evaluate(() => {
    window.location.hash = '#/'
  })
  await expect(roots).toHaveCount(0)
  // The separators between action, time and author are hidden dots
  await expect(
    app.page.getByRole('button', {name: /^Nested media file/})
  ).toContainText(/Edited·.+ago·Local user$/)
  await expect(
    app.page.getByRole('button', {name: /^Uploaded image/})
  ).toContainText(/Created·.+ago·Alice Editor$/)
})

test('keeps a collapsed parent closed when selecting a child elsewhere', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'child',
    title: 'Child'
  })
  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})

  await tree.getByRole('button', {name: 'Collapse Folder'}).click()
  await tree.getByRole('button', {name: 'Expand Other folder'}).click()
  await app.openEntry('Other child')

  await expect(tree.getByRole('button', {name: 'Expand Folder'})).toBeVisible()
})

test('reveals the folder of a nested media file as the current location in the sidebar tree', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  // Follow a link to the file, as the link field settings do
  await app.page.evaluate(hash => {
    window.location.hash = hash
  }, `#/entry/main/media/${dashboardScenarioIds.nestedMediaFile}`)
  await expect(app.title).toHaveText('Nested media file')

  const tree = app.page.getByRole('treegrid', {name: 'Content tree'})
  await expect(
    tree.getByRole('button', {name: 'Collapse Media folder'})
  ).toBeVisible()
  const folder = tree.getByRole('row', {
    name: 'Nested media folder',
    exact: true
  })
  await expect(folder).toBeVisible()
  await expect(folder).toHaveAttribute('aria-selected', 'false')
  await expect(
    folder.getByRole('link', {name: 'Nested media folder'})
  ).toHaveAttribute('aria-current', 'location')
  await expect(tree.getByRole('row', {selected: true})).toHaveCount(0)

  // Pressing the row outside its link selects it, which opens the folder
  const box = await folder.boundingBox()
  await folder.click({position: {x: box!.width - 4, y: box!.height / 2}})

  await expect(app.title).toHaveText('Nested media folder')
  await expect(app.page).toHaveURL(/workflow-nested-media-folder$/)
  await expect(folder).toHaveAttribute('aria-selected', 'true')
  await expect(
    folder.getByRole('link', {name: 'Nested media folder'})
  ).not.toHaveAttribute('aria-current')
  await expect(
    app.page
      .getByRole('grid', {name: 'Explorer entries'})
      .getByRole('row', {name: 'Nested media file', exact: true})
  ).toBeVisible()
})

test('blocks navigation until unsaved changes are resolved', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.field('Title').fill('Unsaved title')
  await app.entry('Beta').click()

  const confirmation = app.page.getByRole('dialog')
  await expect(
    confirmation.getByRole('heading', {name: 'Confirm navigation'})
  ).toBeVisible()
  await expect(confirmation).toContainText('This entry has unsaved changes')
  await expect(app.title).toHaveText('Alpha')

  await confirmation.getByRole('button', {name: 'Discard', exact: true}).click()
  await expect(app.title).toHaveText('Beta')
})

test('publishing from the navigation dialog validates like the header', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.field('Title').fill('Invalid')
  await app.entry('Beta').click()

  const confirmation = app.page.getByRole('dialog', {
    name: 'Confirm navigation'
  })
  const publish = confirmation.getByRole('button', {name: 'Publish'})
  await expect(publish).toBeEnabled()
  await publish.click()

  await expect(
    app.page.getByRole('dialog', {name: 'Fix invalid fields before publishing'})
  ).toBeVisible()
  await expect(confirmation).toHaveCount(0)
  await expect(app.title).toHaveText('Alpha')
})

test('blocks browser history until unsaved changes are resolved', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  await app.openEntry('Beta')

  await app.field('Title').fill('Unsaved beta')
  await app.page.goBack({waitUntil: 'commit'})

  const confirmation = app.page.getByRole('dialog')
  await expect(
    confirmation.getByRole('heading', {name: 'Confirm navigation'})
  ).toBeVisible()
  await expect(app.title).toHaveText('Beta')
  await expect(app.page).toHaveURL(/workflow-beta\?view=edit$/)

  await confirmation.getByRole('button', {name: 'Discard', exact: true}).click()
  await expect(app.title).toHaveText('Alpha')
  await expect(app.field('Title')).toHaveValue('Alpha')
})

test('updates document metadata with dashboard navigation', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await expect(app.page).toHaveTitle('Main: Alpha')
  await app.openEntry('Beta')
  await expect(app.page).toHaveTitle('Main: Beta')

  await app.crumb('Pages').click()
  await expect(app.page).toHaveTitle('Main: Pages')
  await expect(app.page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    /^data:image\/svg\+xml;base64,/
  )
})

test('renders a missing entry route', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    routeEntry: 'missing-entry',
    title: 'Entry not found'
  })

  await expect(app.page.getByText('Requested id:')).toContainText(
    'missing-entry'
  )
  await expect(
    app.page.getByRole('button', {name: 'Go to Pages'})
  ).toBeVisible()
})

test('renders a missing root route without falling through to an entry', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    routeRoot: 'missing-root',
    title: 'Root not found'
  })

  await expect(app.page.getByText('Requested root:')).toContainText(
    'missing-root'
  )
  await expect(
    app.page.getByRole('button', {name: 'Go to Pages'})
  ).toBeVisible()
})

test('searches entries and navigates with enter or click', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.page.getByRole('button', {name: 'Search entries'}).click()
  const enterSearch = app.page.getByRole('dialog', {name: 'Search entries'})
  const enterSearchbox = enterSearch.getByRole('combobox', {name: 'Search'})
  await enterSearchbox.fill('Beta')
  const betaResult = enterSearch.getByRole('row', {name: /Beta/})
  await expect(betaResult).toBeVisible()
  await enterSearchbox.press('ArrowDown')
  await expect(betaResult).toHaveAttribute('aria-selected', 'true')
  await enterSearchbox.press('Enter')
  await expect(app.title).toHaveText('Beta')
  await expect(enterSearch).not.toBeVisible()

  await app.page.getByRole('button', {name: 'Search entries'}).click()
  const clickSearch = app.page.getByRole('dialog', {name: 'Search entries'})
  await clickSearch.getByRole('combobox', {name: 'Search'}).fill('Alpha')
  await clickSearch.getByRole('row', {name: /Alpha/}).click()
  await expect(app.title).toHaveText('Alpha')
  await expect(clickSearch).not.toBeVisible()
})

test('search requires every word and prioritizes title prefixes', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.page.getByRole('button', {name: 'Search entries'}).click()
  const search = app.page.getByRole('dialog', {name: 'Search entries'})
  await search
    .getByRole('combobox', {name: 'Search'})
    .fill('wireless receiver 77 GHz')

  const results = search
    .getByRole('treegrid', {name: 'Explorer entries'})
    .getByRole('row')
  await expect(results).toHaveCount(2)
  await expect(results.nth(0)).toContainText('Wireless receiver at 77 GHz')
  await expect(results.nth(1)).toContainText('Archive')

  await search.getByRole('combobox', {name: 'Search'}).fill('wireless')

  await expect(results).toHaveCount(3)
  await expect(results.nth(0)).toContainText('Wireless receiver at 77 GHz')
  await expect(results.nth(1)).toContainText(
    'Receiver archive for wireless systems'
  )
  await expect(results.nth(2)).toContainText('Archive')
})

test('opens details for a localised file with null alt text', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />), {
    entry: 'mediaFile',
    routeRoot: 'media',
    title: 'Legacy image'
  })

  await expect(app.field('Alt text')).toBeVisible()
  await expect(app.field('Alt text')).toHaveValue('')

  await app.page.getByRole('tab', {name: 'Details'}).click()

  await expect(app.page.getByText('Metadata', {exact: true})).toHaveCount(0)
  // Nobody recorded who uploaded or changed this file
  await expect(app.page.getByText('Created by', {exact: true})).toBeVisible()
  await expect(app.page.getByText('Not available', {exact: true})).toHaveCount(
    4
  )
})

test('splits document metadata into SEO and Details tabs', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))
  const createdAt = app.page.getByText('Created at', {exact: true})

  await app.page.getByRole('tab', {name: 'SEO'}).click()
  await expect(app.field('Description')).toHaveCount(2)
  await expect(app.page.getByText('Open Graph', {exact: true})).toBeVisible()
  await expect(createdAt).toHaveCount(0)

  await app.page.getByRole('tab', {name: 'Details'}).click()
  await expect(createdAt).toBeVisible()
  await expect(app.page.getByText('Updated by', {exact: true})).toBeVisible()
  await expect(app.page.getByText('URL aliases', {exact: true})).toBeVisible()
  await expect(app.field('Description')).toHaveCount(0)
})

// Counts the animation frames in which the dashboard is hidden, or the preview
// tab shows anything but the preview of the entry on screen
async function watchDashboard(page: Page) {
  await page.evaluate(() => {
    const state = {hidden: 0, mismatched: 0}
    Object.assign(window, {dashboardFrames: state})
    function frame() {
      const tree = document.querySelector('[aria-label="Content tree"]')
      const main = document.querySelector('main')
      if (!tree?.checkVisibility() || !main?.checkVisibility()) state.hidden++
      const title = document.querySelector('h1')?.textContent
      const preview = Array.from(document.querySelectorAll('p')).find(p =>
        p.textContent?.startsWith('Preview of ')
      )
      const tab = document.querySelector('[role="tab"][aria-selected="true"]')
      const previewShown = tab?.textContent === 'Preview'
      if (previewShown && preview?.textContent !== `Preview of ${title}`)
        state.mismatched++
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
  return () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            dashboardFrames: {hidden: number; mismatched: number}
          }
        ).dashboardFrames
    )
}

test('keeps the current entry on screen while the next preview loads', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() =>
    mount(<DashboardScenarioMount slowPreview />)
  )
  await expect(app.page.getByText('Preview of Alpha')).toBeVisible()
  const frames = await watchDashboard(app.page)

  await app.entry('Beta').click()
  await expect(app.title).toHaveText('Alpha')
  await expect(app.page.getByText('Preview of Beta')).toBeVisible()
  await expect(app.title).toHaveText('Beta')

  await app.page.goBack()
  await expect(app.page.getByText('Preview of Alpha')).toBeVisible()

  expect(await frames()).toEqual({hidden: 0, mismatched: 0})
})

test('keeps the overview on screen while an entry preview loads', async ({
  dashboard,
  mount
}) => {
  const app = await dashboard.mount(() =>
    mount(<DashboardScenarioMount slowPreview />)
  )
  await app.crumb('Pages').click()
  const overview = app.page.getByRole('treegrid', {name: 'Explorer entries'})
  await expect(overview).toBeVisible()
  const frames = await watchDashboard(app.page)

  await overview.getByRole('row', {name: /^Beta/}).click()
  await expect(overview).toBeVisible()
  await expect(app.page.getByText('Preview of Beta')).toBeVisible()
  await expect(app.title).toHaveText('Beta')

  await app.page.getByRole('tab', {name: 'History'}).click()
  await expect(app.page.getByText('Preview of Beta')).toHaveCount(0)
  await app.page.getByRole('tab', {name: 'Preview'}).click()
  await expect(app.page.getByText('Preview of Beta')).toBeVisible()

  expect(await frames()).toEqual({hidden: 0, mismatched: 0})
})
