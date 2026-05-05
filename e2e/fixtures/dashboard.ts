import {expect, test as base, type Locator, type Page} from 'playwright/test'

export interface DashboardRoute {
  workspace?: string
  root?: string
  locale?: string
  entry?: string
}

export interface DashboardFixtures {
  dashboard: DashboardPage
}

export class DashboardPage {
  constructor(public page: Page) {}

  async goto(route: DashboardRoute = {}) {
    const workspace = route.workspace ?? 'simple'
    const root = route.root ?? 'pages'
    const rootPart = route.locale ? `${root}:${route.locale}` : root
    const parts = ['entry', workspace, rootPart, route.entry].filter(Boolean)
    await this.page.goto(`/#/${parts.join('/')}`)
    await this.waitForReady()
  }

  async waitForReady() {
    await expect(
      this.page.getByRole('treegrid', {name: 'Content tree'})
    ).toBeVisible()
  }

  async selectRoot(label: string) {
    await this.page.getByRole('button', {name: label, exact: true}).click()
  }

  async openTreeItem(label: string) {
    await this.treeItem(label).click()
    await expect(this.page.getByRole('heading', {name: label})).toBeVisible()
  }

  async expandTreeItem(label: string) {
    await this.page
      .getByRole('button', {name: `Expand ${label}`, exact: true})
      .click()
  }

  treeItem(label: string): Locator {
    return this.page.getByRole('row', {name: label, exact: true})
  }

  field(label: string): Locator {
    return this.page.getByLabel(label, {exact: true})
  }

  button(label: string): Locator {
    return this.page.getByRole('button', {name: label, exact: true})
  }
}

async function dashboardFixture(
  {page}: {page: Page},
  use: (dashboard: DashboardPage) => Promise<void>
) {
  await use(new DashboardPage(page))
}

export const test = base.extend<DashboardFixtures>({
  dashboard: dashboardFixture
})

export {expect}
