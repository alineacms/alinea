import {createTestConnection} from '#test/CreateConnection.js'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {expect, test} from 'bun:test'
import {clientAtom} from './core.js'
import {configAtom} from './core.js'
import {authReady, canManageMembersAtom, policyAtom, userAtom} from './user.js'

test('user and policy are synchronous after preloading', async () => {
  const {store} = await createDashboardAtomFixture()

  expect(() => store.get(userAtom)).toThrow('Dashboard user was not preloaded')
  expect(() => store.get(policyAtom)).toThrow(
    'Dashboard policy was not preloaded'
  )

  await store.get(authReady)

  expect(store.get(userAtom).sub).toBe('local')
  expect(store.get(policyAtom).canManageMembers()).toBeTrue()
})

test('policy stays stale while its replacement resolves', async () => {
  const {config, store} = await createDashboardAtomFixture()
  const unsubscribe = store.sub(authReady, () => {})
  await store.get(authReady)
  const previousUser = store.get(userAtom)
  const previousPolicy = store.get(policyAtom)

  store.set(configAtom, {...config, roles: {}})

  expect(store.get(userAtom)).toBe(previousUser)
  expect(store.get(policyAtom)).toBe(previousPolicy)

  await Promise.resolve()
  await store.get(authReady)

  expect(store.get(userAtom)).toBe(previousUser)
  expect(store.get(policyAtom).canManageMembers()).toBeFalse()
  unsubscribe()
})

test('requires backend support before exposing user management', async () => {
  const {db, store} = await createDashboardAtomFixture()
  store.set(
    clientAtom,
    createTestConnection(db, {capabilities: {users: false}})
  )

  expect(await store.get(canManageMembersAtom)).toBeFalse()
})
