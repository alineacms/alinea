import {expect, test} from '../support/DashboardTest.js'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'

test('restores a previous revision as a draft', async ({dashboard, mount}) => {
  const app = await dashboard.mount(() => mount(<DashboardScenarioMount />))

  await app.page.getByRole('tab', {name: 'History'}).click()
  await app.page.getByRole('button', {name: 'Previous versions'}).click()
  await app.page.evaluate(() => {
    document.documentElement.dataset.historyLoaderSeen = 'false'
    const observer = new MutationObserver(() => {
      if (document.querySelector('[aria-label="Loading history"]'))
        document.documentElement.dataset.historyLoaderSeen = 'true'
    })
    observer.observe(document.body, {childList: true, subtree: true})
  })
  await app.page.getByRole('button', {name: /Alice Historian/}).click()

  await expect(app.field('Title')).toHaveValue('Historical Alpha')
  await expect
    .poll(() =>
      app.page.evaluate(
        () => document.documentElement.dataset.historyLoaderSeen
      )
    )
    .toBe('false')
  await app.page.getByRole('button', {name: 'Create draft'}).click()
  await expect(app.title).toHaveText('Historical Alpha')

  await app.openEntry('Beta')
  await app.openEntry('Historical Alpha')
  await expect(app.field('Title')).toHaveValue('Historical Alpha')
})
