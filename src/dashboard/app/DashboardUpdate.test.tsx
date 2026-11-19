import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {act, cleanup, render, screen} from '#test/react.js'
import {afterEach, beforeEach, expect, test} from 'bun:test'
import {atom, Provider} from 'jotai'
import {eventsAtom} from '../atoms/core.js'
import {routeGuardAtom} from '../atoms/nav.js'
import {VersionEvent} from '../boot/VersionEvent.js'
import {DashboardUpdate} from './DashboardUpdate.js'

let visibility: DocumentVisibilityState = 'visible'
let reloads = 0
const reload = location.reload

beforeEach(() => {
  visibility = 'visible'
  reloads = 0
  sessionStorage.clear()
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility
  })
  Object.defineProperty(location, 'reload', {
    configurable: true,
    value: () => {
      reloads += 1
    }
  })
})

afterEach(() => {
  cleanup()
  Object.defineProperty(location, 'reload', {configurable: true, value: reload})
})

async function renderOutdated(unsaved = false) {
  const {store} = await createDashboardAtomFixture()
  if (unsaved) store.set(routeGuardAtom, atom(true))
  render(
    <Provider store={store}>
      <DashboardUpdate />
    </Provider>
  )
  act(() => {
    store.get(eventsAtom).dispatchEvent(new VersionEvent(true))
  })
  await screen.findByText('A new version of the dashboard is available')
}

function hide() {
  act(() => {
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

test('a visible tab asks to reload', async () => {
  await renderOutdated()
  expect(screen.getByRole('button', {name: 'Reload'})).toBeTruthy()
  expect(reloads).toBe(0)
})

test('a tab reloads once it is out of view', async () => {
  await renderOutdated()
  hide()
  expect(reloads).toBe(1)
})

test('a tab with unsaved changes does not reload by itself', async () => {
  await renderOutdated(true)
  hide()
  expect(reloads).toBe(0)
})

test('a tab that just reloaded for an update does not reload again', async () => {
  sessionStorage.setItem('alinea-reloaded-for-update', String(Date.now()))
  await renderOutdated()
  hide()
  expect(reloads).toBe(0)
})
