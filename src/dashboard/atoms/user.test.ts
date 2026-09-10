import {createTestConnection} from '#test/CreateConnection.js'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {expect, spyOn, test} from 'bun:test'
import {Policy, Permission} from '#/core/Role.js'
import {clientAtom} from './core.js'
import {configAtom} from './core.js'
import {eventsAtom} from './core.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
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

test('replica-backed policy comes from compiled grants without executing client roles', async () => {
  const {db, store} = await createDashboardAtomFixture()
  const policy = new Policy(Permission.Explore)
  Object.assign(db, {compiledPolicy: async () => policy})
  const local = spyOn(db, 'createPolicy').mockImplementation(async () => {
    throw new Error('Client roles must not execute')
  })
  try {
    await store.get(authReady)
    expect(store.get(policyAtom)).toBe(policy)
    expect(local).not.toHaveBeenCalled()
    expect(store.get(policyAtom).canManageMembers()).toBe(false)
  } finally {
    local.mockRestore()
  }
})

test('compiled policy refreshes for same-content view events and fails closed on invalidation', async () => {
  const {db, store} = await createDashboardAtomFixture()
  let policy = new Policy(Permission.All)
  Object.assign(db, {compiledPolicy: async () => policy})
  const stop = store.sub(authReady, () => {})
  await store.get(authReady)
  const events = store.get(eventsAtom)
  policy = new Policy(Permission.Explore)
  events.dispatchEvent(new IndexEvent({op: 'index', sha: db.sha, ids: []}))
  await store.get(authReady)
  expect(store.get(policyAtom).canManageMembers()).toBe(false)
  events.dispatchEvent(
    new IndexEvent({op: 'invalidate', error: new Error('Revoked')})
  )
  expect(() => store.get(policyAtom)).toThrow('Revoked')
  await expect(store.get(authReady)).rejects.toThrow('Revoked')
  stop()
})
