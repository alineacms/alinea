import {expect, test} from '@playwright/experimental-ct-react'
import {DashboardScenarioMount} from '../support/DashboardScenarioMount.js'
import {dashboardScenarioIds} from '../support/DashboardScenarioData.js'

test('shows the progress of the initial sync below the spinner', async ({
  mount,
  page
}) => {
  await page.evaluate(alpha => {
    window.history.replaceState(null, '', `#/entry/main/pages/${alpha}`)
  }, dashboardScenarioIds.alpha)
  await mount(<DashboardScenarioMount syncDelay={40} />)

  const spinner = page.getByRole('progressbar', {name: 'Loading dashboard'})
  await expect(
    page.getByText(/^Syncing content · \d+ of \d+ files$/)
  ).toBeVisible()
  await expect(spinner).toHaveAttribute('aria-valuenow', /^\d+$/)

  await expect(page.getByRole('heading', {level: 1})).toHaveText('Alpha', {
    timeout: 15_000
  })
  await expect(page.getByText(/^Syncing content/)).toHaveCount(0)
})
