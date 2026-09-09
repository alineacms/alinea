import {expect, test} from 'bun:test'
import {LocalDB} from '#/core/db/LocalDB.js'
import {Policy} from '#/core/Role.js'
import {localUser} from '#/core/User.js'
import {
  createDashboardStore,
  DashboardTestPage
} from '#test/DashboardFixture.js'
import {Config} from '#/index.js'
import {pageAtom, routeAtom} from './nav.js'
import {preloadUserPolicyAtom} from './user.js'

function dashboardStore(workspaces: 1 | 2) {
  const config = Config.create({
    schema: {Page: DashboardTestPage},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content/main',
        roots: {pages: Config.root('Pages', {contains: ['Page']})}
      }),
      ...(workspaces === 2
        ? {
            secondary: Config.workspace('Secondary', {
              source: 'content/secondary',
              roots: {
                pages: Config.root('Pages', {contains: ['Page']})
              }
            })
          }
        : {})
    }
  })
  const store = createDashboardStore(config, new LocalDB(config))
  store.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
  return store
}

test('skips the splash for a single readable workspace', () => {
  const store = dashboardStore(1)
  store.set(routeAtom, {browser: true, route: {page: 'splash'}})

  expect(store.get(pageAtom)).toMatchObject({
    type: 'entry',
    workspace: 'main',
    root: 'pages'
  })
})

test('shows the splash for multiple readable workspaces', () => {
  const store = dashboardStore(2)
  store.set(routeAtom, {browser: true, route: {page: 'splash'}})

  expect(store.get(pageAtom)).toMatchObject({
    type: 'splash',
    workspace: undefined,
    root: undefined
  })
})
