import {AuthResultType, type AuthResult} from '#/cloud/AuthResult.js'
import {Client} from '#/core/Client.js'
import {localUser} from '#/core/User.js'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {act, cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Provider} from 'jotai'
import {AppLoading, appAtom} from './App.js'
import {authAtom} from './atoms/auth.js'
import {clientAtom, eventsAtom, localAtom} from './atoms/core.js'
import {SyncEvent} from './boot/SyncEvent.js'

afterEach(cleanup)

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

test('the loading screen shows the progress of a sync', async () => {
  const {store} = await createDashboardAtomFixture()
  const events = store.get(eventsAtom)
  render(
    <Provider store={store}>
      <AppLoading />
    </Provider>
  )
  const spinner = screen.getByRole('progressbar', {name: 'Loading dashboard'})
  expect(spinner.getAttribute('aria-valuenow')).toBeNull()
  expect(screen.queryByText(/Syncing content/)).toBeNull()

  act(() => {
    events.dispatchEvent(new SyncEvent({loaded: 1200, total: 4800}))
  })
  expect(spinner.getAttribute('aria-valuenow')).toBe('25')
  expect(
    screen.getByText(
      `Syncing content · ${(1200).toLocaleString()} of ${(4800).toLocaleString()} files`
    )
  ).toBeTruthy()

  act(() => {
    events.dispatchEvent(new SyncEvent({loaded: 4800, total: 4800}))
  })
  expect(spinner.getAttribute('aria-valuenow')).toBeNull()
  expect(screen.getByText('Indexing content')).toBeTruthy()

  act(() => {
    events.dispatchEvent(new SyncEvent())
  })
  expect(spinner.getAttribute('aria-valuenow')).toBeNull()
  expect(screen.queryByText('Indexing content')).toBeNull()
})
