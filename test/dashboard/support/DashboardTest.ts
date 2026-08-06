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
  routeEntry?: string
  routeRoot?: string
  title?: string
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
  dashboard: async ({page}, provide) => {
    const pageErrors: Array<Error> = []
    function onPageError(error: Error) {
      pageErrors.push(error)
    }
    page.on('pageerror', onPageError)
    await provide({
      async mount(render, options = {}) {
        const entry = options.entry ?? 'alpha'
        const id = options.routeEntry ?? dashboardScenarioIds[entry]
        const root = options.routeRoot ?? 'pages'
        await page.evaluate(() => {
          localStorage.removeItem('alinea-dashboard-theme')
          document.documentElement.removeAttribute('data-theme')
        })
        await page.evaluate(hash => {
          window.history.replaceState(null, '', hash)
        }, `#/entry/main/${root}/${id}`)
        const component = await render()
        const driver = new DashboardDriver(page, component)
        const expectedTitle =
          options.title ?? entry[0].toUpperCase() + entry.slice(1)
        await expect(driver.title).toHaveText(expectedTitle)
        return driver
      }
    })
    page.off('pageerror', onPageError)
    expect(
      pageErrors.map(error => error.stack ?? error.message),
      'Dashboard emitted an uncaught page error'
    ).toEqual([])
  }
})

export {expect}
