import {
  AccessDeniedScenarioMount,
  UserAccessDeniedScenarioMount
} from '#test/dashboard/support/AccessDeniedScenarioMount.js'
import {
  MissingApiKeyScenario,
  MissingHandlerScenario
} from './support/AuthScenario.js'
import {routes} from './support/VisualRoutes.js'
import {
  FieldsScenarioMount,
  FixtureScenarioMount
} from './support/VisualScenarioMount.js'
import {expect, test, themed} from './support/VisualTest.js'

function pageTests() {
  test('users page', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.users,
      ready: page => page.getByRole('searchbox', {name: 'Search users'})
    })
    await expect(
      app.page.getByRole('row', {name: /Alice Editor/})
    ).toBeVisible()
    await app.shot('users')
  })

  test('media file editor', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.panorama,
      title: 'panorama'
    })
    await app.shot('media-file')
  })

  test('access denied', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<AccessDeniedScenarioMount />), {
      ready: page => page.getByRole('heading', {name: 'No workspace access'})
    })
    await app.shot('access-denied')
  })

  test('error boundary', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FieldsScenarioMount />), {
      hash: '#/entry/main/pages/visual-broken',
      ready: page => page.getByText('This view failed to render').first()
    })
    await app.shot('error-boundary')
  })
}

themed(() => {
  pageTests()

  test('edit user', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.users,
      ready: page => page.getByRole('searchbox', {name: 'Search users'})
    })
    await app.page
      .getByRole('button', {name: 'Actions for Alice Editor'})
      .click()
    await expect(app.page.getByRole('menu')).toBeVisible()
    await app.shot('users-actions')
    await app.page.getByRole('menuitem', {name: 'Edit'}).click()
    await expect(app.page.getByRole('dialog')).toBeVisible()
    await app.shot('users-edit')
  })

  test('create user', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.users,
      ready: page => page.getByRole('searchbox', {name: 'Search users'})
    })
    await app.page.getByRole('button', {name: 'Create user'}).click()
    await expect(app.page.getByRole('dialog')).toBeVisible()
    await app.shot('users-create')
  })

  test('deactivate user', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<FixtureScenarioMount />), {
      hash: routes.users,
      ready: page => page.getByRole('searchbox', {name: 'Search users'})
    })
    await app.page
      .getByRole('button', {name: 'Actions for Alice Editor'})
      .click()
    await app.page.getByRole('menuitem', {name: 'Deactivate account'}).click()
    await expect(app.page.getByRole('dialog')).toBeVisible()
    await app.shot('users-deactivate')
  })

  test('user management access denied', async ({mount, visual}) => {
    const app = await visual.open(
      () => mount(<UserAccessDeniedScenarioMount />),
      {
        hash: routes.users,
        ready: page =>
          page.getByRole('heading', {name: 'No user management access'})
      }
    )
    await app.shot('users-access-denied')
  })

  test('auth missing handler', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<MissingHandlerScenario />), {
      ready: page => page.getByText('Ready to deploy?')
    })
    await app.shot('auth-missing-handler')
  })

  test('auth missing api key', async ({mount, visual}) => {
    const app = await visual.open(() => mount(<MissingApiKeyScenario />), {
      ready: page => page.getByText('Ready to deploy?')
    })
    await app.shot('auth-missing-api-key')
  })
})

test.describe('mobile', () => {
  test.use({viewport: {width: 390, height: 844}})
  themed(pageTests)
})
