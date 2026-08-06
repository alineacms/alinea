import {createTestConnection} from '#test/CreateConnection.js'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {expect, test} from 'bun:test'
import {clientAtom} from './core.js'
import {canManageMembersAtom} from './user.js'

test('requires backend support before exposing user management', async () => {
  const {db, store} = await createDashboardAtomFixture()
  store.set(
    clientAtom,
    createTestConnection(db, {capabilities: {users: false}})
  )

  expect(await store.get(canManageMembersAtom)).toBeFalse()
})
