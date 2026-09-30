import {Policy} from '#/core/Role.js'
import {localUser, type User} from '#/core/User.js'
import {clientAtom} from '#/dashboard/atoms/core.js'
import {pageAtom, routeAtom} from '#/dashboard/atoms/nav.js'
import {preloadUserPolicyAtom} from '#/dashboard/atoms/user.js'
import {LocalDB} from '#/database/LocalDB.js'
import {
  createDashboardStore,
  dashboardTestConfig
} from '#test/DashboardFixture.js'
import {expect, spyOn, test} from 'bun:test'
import {atom} from 'jotai'
import {usersAtom, usersPage} from './UsersPage.js'

function usersStore() {
  const config = dashboardTestConfig
  const store = createDashboardStore(config, new LocalDB(config))
  store.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
  // Rendered like the app renders the users page while it is open
  const app = atom(get => {
    const page = get(pageAtom)
    return page.type === 'users' ? usersPage(page, get) : null
  })
  store.sub(app, () => {})
  async function navigate(page: 'users' | 'splash') {
    store.set(routeAtom, {browser: true, route: {page}})
    await store.get(app)
  }
  return {store, client: store.get(clientAtom), navigate}
}

test('loads the users once per visit to the page', async () => {
  const {client, navigate} = usersStore()
  const listUsers = spyOn(client, 'listUsers')

  await navigate('users')
  expect(listUsers).toHaveBeenCalledTimes(1)
  await navigate('users')
  expect(listUsers).toHaveBeenCalledTimes(1)
  await navigate('splash')
  expect(listUsers).toHaveBeenCalledTimes(1)
  await navigate('users')
  expect(listUsers).toHaveBeenCalledTimes(2)
})

test('keeps an edit saved while the users load again', async () => {
  const {store, client, navigate} = usersStore()
  await navigate('users')
  const jane = {sub: 'jane', email: 'jane@example.com', name: 'Jane'}
  const {promise: saved, resolve: save} = Promise.withResolvers<User>()
  const {promise: listed, resolve: list} = Promise.withResolvers<Array<User>>()
  spyOn(client, 'createUser').mockReturnValue(saved)
  spyOn(client, 'listUsers').mockReturnValue(listed)

  const creating = store.set(usersAtom, {type: 'create', user: jane})
  await navigate('splash')
  store.set(routeAtom, {browser: true, route: {page: 'users'}})
  list([])
  save(jane)
  await creating
  expect(await store.get(usersAtom)).toEqual([jane])
})
