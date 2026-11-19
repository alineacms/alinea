import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {act, cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, beforeEach, expect, test} from 'bun:test'
import {Provider} from 'jotai'
import {eventsAtom, graphAtom} from '../atoms/core.js'
import {routeGuardAtom} from '../atoms/nav.js'
import {ReactiveNode} from '../atoms/ReactiveNode.js'
import {openEditsAtom} from '../atoms/version.js'
import type {Activity} from '../boot/ActivityEvent.js'
import {VersionEvent} from '../boot/VersionEvent.js'
import {DashboardUpdate} from './DashboardUpdate.js'

const keptEditsKey = 'alinea-edits-kept-for-update'
let visibility: DocumentVisibilityState = 'visible'
let reloads = 0
let confirms = 0
const reload = location.reload
const confirm = window.confirm

beforeEach(() => {
  visibility = 'visible'
  reloads = 0
  confirms = 0
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
  window.confirm = () => {
    confirms += 1
    return false
  }
})

afterEach(() => {
  cleanup()
  Object.defineProperty(location, 'reload', {configurable: true, value: reload})
  window.confirm = confirm
})

interface OutdatedOptions {
  unsaved?: boolean
  /** Activities the worker reports */
  activities?: Array<Activity>
}

async function renderOutdated({unsaved, activities}: OutdatedOptions = {}) {
  const {store} = await createDashboardAtomFixture()
  if (unsaved) {
    const node = new ReactiveNode<object>({title: 'Saved'}, false, {
      title: 'Edited'
    })
    store.set(routeGuardAtom, node.isDirty)
    store.set(openEditsAtom, {entryId: 'entry', locale: null, node})
  }
  const worker = {activities: activities ?? []}
  Object.assign(store.get(graphAtom), {
    async activities() {
      return worker.activities
    }
  })
  render(
    <Provider store={store}>
      <DashboardUpdate />
    </Provider>
  )
  act(() => {
    store.get(eventsAtom).dispatchEvent(new VersionEvent(true))
  })
  await screen.findByText('A new version of the dashboard is available')
  return worker
}

async function hide() {
  await act(async () => {
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise(resolve => setTimeout(resolve, 10))
  })
}

const failedChange: Activity = {
  id: 'refused',
  type: 'mutation',
  status: 'failed',
  operations: [],
  startedAt: 0
}

test('a visible tab asks to reload', async () => {
  await renderOutdated()
  expect(screen.getByRole('button', {name: 'Reload'})).toBeTruthy()
  expect(reloads).toBe(0)
})

test('a tab reloads once it is out of view', async () => {
  await renderOutdated()
  await hide()
  expect(reloads).toBe(1)
})

test('a tab with unsaved changes keeps them over the reload', async () => {
  await renderOutdated({unsaved: true})
  expect(
    screen.getByText(
      'Reload to continue editing. Your unsaved changes are kept.'
    )
  ).toBeTruthy()
  await hide()
  expect(reloads).toBe(1)
  expect(JSON.parse(sessionStorage.getItem(keptEditsKey)!)).toEqual({
    entryId: 'entry',
    locale: null,
    checkpoint: {title: 'Saved'},
    edited: {title: 'Edited'}
  })
})

test('a tab with a change that is not committed does not reload by itself', async () => {
  const worker = await renderOutdated({activities: [failedChange]})
  await hide()
  expect(reloads).toBe(0)
  // Once it settles, the next check reloads
  worker.activities = []
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise(resolve => setTimeout(resolve, 10))
  })
  expect(reloads).toBe(1)
})

test('a tab with an open dialog does not reload by itself', async () => {
  await renderOutdated()
  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  document.body.append(dialog)
  try {
    await hide()
    expect(reloads).toBe(0)
  } finally {
    dialog.remove()
  }
})

test('a tab that just reloaded for an update does not reload again', async () => {
  sessionStorage.setItem('alinea-reloaded-for-update', String(Date.now()))
  await renderOutdated()
  await hide()
  expect(reloads).toBe(0)
})

test('reloading by hand asks first when a change would be lost', async () => {
  await renderOutdated({unsaved: true, activities: [failedChange]})
  await act(async () => {
    fireEvent.click(screen.getByRole('button', {name: 'Reload'}))
    await new Promise(resolve => setTimeout(resolve, 10))
  })
  expect(confirms).toBe(1)
  expect(reloads).toBe(0)
  // A cancelled reload keeps nothing for later
  expect(sessionStorage.getItem(keptEditsKey)).toBeNull()
})
