import {
  expect,
  test as base,
  type MountResult
} from '@playwright/experimental-ct-react'
import type {Locator, Page} from 'playwright'
import {dashboardScenarioIds} from './DashboardScenarioData.js'

type DashboardScenarioName = keyof typeof dashboardScenarioIds

interface MountDashboardOptions {
  entry?: DashboardScenarioName
}

interface DashboardFixture {
  mount(
    render: () => Promise<MountResult>,
    options?: MountDashboardOptions
  ): Promise<DashboardDriver>
}

export class DashboardDriver {
  constructor(
    readonly page: Page,
    readonly component: MountResult
  ) {}

  field(label: string): Locator {
    return this.page.getByRole('textbox', {name: label, exact: true})
  }

  entry(name: string): Locator {
    return this.page.getByRole('row', {name, exact: true})
  }

  get navigationPending(): Locator {
    return this.page.locator('main[data-navigation-pending]')
  }

  get title(): Locator {
    return this.page.getByRole('heading', {level: 1})
  }

  async openProfile(): Promise<void> {
    await this.page.getByRole('button', {name: 'Local user'}).click()
    await expect(this.page.getByText('Theme', {exact: true})).toBeVisible()
  }

  async openUsers(): Promise<void> {
    await this.openProfile()
    await this.page.getByRole('button', {name: 'Manage users'}).click()
    await expect(
      this.page.getByText('Manage users', {exact: true})
    ).toBeVisible()
  }

  async runEntryAction(name: string): Promise<void> {
    await this.page.getByRole('button', {name: 'More actions'}).click()
    await this.page.getByRole('menuitem', {name, exact: true}).click()
  }

  async openEntry(name: string) {
    await this.entry(name).click()
    await expect(this.title).toHaveText(name)
  }
}

export const test = base.extend<{dashboard: DashboardFixture}>({
  dashboard: async ({page}, use) => {
    await use({
      async mount(render, options = {}) {
        const entry = options.entry ?? 'alpha'
        const id = dashboardScenarioIds[entry]
        await page.evaluate(() => {
          localStorage.removeItem('alinea-dashboard-theme')
          document.documentElement.removeAttribute('data-theme')
        })
        await page.evaluate(hash => {
          window.history.replaceState(null, '', hash)
        }, `#/entry/main/pages/${id}`)
        const component = await render()
        const driver = new DashboardDriver(page, component)
        const expectedTitle = entry[0].toUpperCase() + entry.slice(1)
        await expect(driver.title).toHaveText(expectedTitle)
        return driver
      }
    })
  }
})

export {expect}
