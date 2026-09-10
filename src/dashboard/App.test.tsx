import {AuthResultType, type AuthResult} from '#/cloud/AuthResult.js'
import {Client} from '#/core/Client.js'
import {localUser} from '#/core/User.js'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {expect, test} from 'bun:test'
import {appAtom} from './App.js'
import {authAtom} from './atoms/auth.js'
import {clientAtom, localAtom} from './atoms/core.js'

test('does not synchronize the graph until authentication has settled', async () => {
  const {config, db, store} = await createDashboardAtomFixture()
  let resolveAuth: ((result: AuthResult) => void) | undefined
  let releaseSync: (() => void) | undefined
  let markSyncStarted: (() => void) | undefined
  let markSyncFinished: (() => void) | undefined
  const authResult = new Promise<AuthResult>(resolve => {
    resolveAuth = resolve
  })
  const syncStarted = new Promise<void>(resolve => {
    markSyncStarted = resolve
  })
  const holdSync = new Promise<void>(resolve => {
    releaseSync = resolve
  })
  const syncFinished = new Promise<void>(resolve => {
    markSyncFinished = resolve
  })
  let syncs = 0
  db.sync = async () => {
    syncs += 1
    markSyncStarted?.()
    await holdSync
    markSyncFinished?.()
    return db.sha
  }
  const client = new Client({config, url: '/api/cms'})
  client.authStatus = () => authResult
  store.set(localAtom, false)
  store.set(clientAtom, client)
  const unsubscribe = store.sub(appAtom, () => {})

  const authenticate = store.set(authAtom, {type: 'check'})
  await Promise.resolve()

  expect(syncs).toBe(0)

  resolveAuth?.({
    type: AuthResultType.Authenticated,
    user: localUser,
    capabilities: {users: false}
  })
  await authenticate
  await syncStarted

  expect(syncs).toBe(1)

  releaseSync?.()
  await syncFinished
  unsubscribe()
})
