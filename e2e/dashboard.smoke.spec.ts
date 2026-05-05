import {expect, test} from './fixtures/dashboard.js'

test('opens the fixture dashboard and edits an entry', async ({dashboard}) => {
  await dashboard.goto()

  await dashboard.openTreeItem('Home')

  await expect(dashboard.field('Title')).toHaveValue('Home')
  await dashboard.field('Title').fill('Home updated')
  await expect(dashboard.button('Save draft')).toBeVisible()
})
