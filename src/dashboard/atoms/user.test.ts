import {AuthResultType, type AuthResult} from '#/cloud/AuthResult.js'
import {Client} from '#/core/Client.js'
import {localUser} from '#/core/User.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {expect, test} from 'bun:test'
import {authAtom} from './auth.js'
import {clientAtom, configAtom, localAtom} from './core.js'
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

test('uses capabilities bundled with authentication', async () => {
  const {config, store} = await createDashboardAtomFixture()
  const client = new Client({config, url: '/api/cms'})
  client.authStatus = async (): Promise<AuthResult> => ({
    type: AuthResultType.Authenticated,
    user: localUser,
    capabilities: {users: false}
  })
  client.capabilities = () => {
    throw new Error('Capabilities should not be requested separately')
  }
  store.set(localAtom, false)
  store.set(clientAtom, client)

  await store.set(authAtom, {type: 'check'})

  expect(await store.get(canManageMembersAtom)).toBeFalse()
})
