import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {act, cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Provider, useAtom, useAtomValueRaw} from 'jotai'
import {useEffect} from 'react'
import {appAtom} from '../App.js'
import {
  activityAtom,
  activityPendingAtom,
  uploadProgressAtom
} from '../atoms/activity.js'
import {eventsAtom} from '../atoms/core.js'
import {syncProgressAtom} from '../atoms/graph.js'
import {routeAtom} from '../atoms/nav.js'
import {ActivityEvent} from '../boot/ActivityEvent.js'
import {SyncEvent} from '../boot/SyncEvent.js'
import {ActivityStatus as ActivityStatusView} from './ActivityStatus.js'

afterEach(cleanup)

function ActivityPendingSubscription() {
  const [appPending] = useAtomValueRaw(appAtom)
  const activity = useAtomValueRaw(activityAtom)
  const sync = useAtomValueRaw(syncProgressAtom)
  const [, setActivityPending] = useAtom(activityPendingAtom)
  const pending = appPending || activity.isMutating || Boolean(sync)
  useEffect(() => {
    setActivityPending(pending)
  }, [pending, setActivityPending])
  return null
}

function ActivityStatus() {
  return (
    <>
      <ActivityPendingSubscription />
      <ActivityStatusView />
    </>
  )
}

test('shows a loader while the next page is loading past the delay', async () => {
  const {db, parent, store} = await createDashboardAtomFixture()
  const find = db.find.bind(db)
  let release: (() => void) | undefined
  const hold = new Promise<void>(resolve => {
    release = resolve
  })
  const delayedFind: typeof db.find = async query => {
    await hold
    return find(query)
  }
  Object.assign(db, {find: delayedFind})
  store.set(routeAtom, {
    workspace: parent._workspace,
    root: parent._root,
    entry: parent._id
  })

  const view = render(
    <Provider store={store}>
      <ActivityStatus />
    </Provider>
  )

  expect(await screen.findByRole('button', {name: 'Loading page'})).toBeTruthy()
  expect(screen.queryByRole('progressbar')).toBeNull()
  expect(
    await screen.findByRole('progressbar', {name: 'Loading page'})
  ).toBeTruthy()
  release?.()
  view.unmount()
})

test('shows spinners only while activity rows are running', async () => {
  const {db, store} = await createDashboardAtomFixture()
  const events = store.get(eventsAtom)
  const timestamp = Date.now()
  const running = {
    id: 'buffered-mutation',
    type: 'mutation' as const,
    status: 'running' as const,
    operations: [{op: 'update', title: 'Page'}],
    startedAt: timestamp
  }
  Object.assign(db, {
    async activities() {
      return [running]
    }
  })

  const view = render(
    <Provider store={store}>
      <ActivityStatus />
    </Provider>
  )
  fireEvent.click(await screen.findByRole('button', {name: 'Syncing changes'}))
  expect(screen.getByRole('progressbar', {name: 'Syncing'})).toBeTruthy()

  act(() =>
    events.dispatchEvent(
      new ActivityEvent([
        {...running, status: 'succeeded', finishedAt: Date.now()}
      ])
    )
  )
  expect(screen.queryByRole('progressbar', {name: 'Syncing'})).toBeNull()
  expect(screen.getByText('Synced')).toBeTruthy()
  view.unmount()
})

test('removes transient upload progress when the worker takes over', async () => {
  const {db, parent, store} = await createDashboardAtomFixture()
  Object.assign(db, {
    async activities() {
      return []
    }
  })
  const upload = {id: 'buffered-upload', file: new File(['file'], 'photo.jpg')}
  const destination = {
    workspace: parent._workspace,
    root: parent._root,
    parentId: parent._id
  }
  const view = render(
    <Provider store={store}>
      <ActivityStatus />
    </Provider>
  )

  act(() =>
    store.set(uploadProgressAtom, {
      type: 'start',
      uploads: [upload],
      destination
    })
  )
  fireEvent.click(await screen.findByRole('button', {name: 'Syncing changes'}))
  expect(
    await screen.findByRole('progressbar', {name: 'Uploading'})
  ).toBeTruthy()

  act(() =>
    store.set(uploadProgressAtom, {
      type: 'finish',
      ids: [upload.id]
    })
  )
  expect(screen.queryByRole('progressbar', {name: 'Uploading'})).toBeNull()
  expect(screen.queryByText('photo.jpg')).toBeNull()
  view.unmount()
})

test('offers retry but not discard for a failed mutation', async () => {
  const {db, store} = await createDashboardAtomFixture()
  Object.assign(db, {
    async activities() {
      return [
        {
          id: 'failed-mutation',
          type: 'mutation',
          status: 'failed',
          error: 'Could not save changes',
          operations: [{op: 'update', title: 'Page'}],
          startedAt: 1,
          finishedAt: 2
        }
      ]
    }
  })

  const view = render(
    <Provider store={store}>
      <ActivityStatus />
    </Provider>
  )

  fireEvent.click(await screen.findByRole('button', {name: 'Activity failed'}))
  expect(await screen.findByText('Could not save changes')).toBeTruthy()
  expect(screen.getByRole('button', {name: 'Retry'})).toBeTruthy()
  expect(screen.queryByRole('button', {name: 'Discard'})).toBeNull()
  view.unmount()
})

test('keeps discard available for a failed upload', async () => {
  const {db, store} = await createDashboardAtomFixture()
  Object.assign(db, {
    async activities() {
      return [
        {
          id: 'failed-upload',
          type: 'upload',
          status: 'failed',
          error: 'Could not upload file',
          operations: [{op: 'uploadFile', title: 'photo.jpg'}],
          startedAt: 1,
          finishedAt: 2
        }
      ]
    }
  })

  const view = render(
    <Provider store={store}>
      <ActivityStatus />
    </Provider>
  )

  fireEvent.click(await screen.findByRole('button', {name: 'Activity failed'}))
  expect(await screen.findByText('Could not upload file')).toBeTruthy()
  expect(screen.getByRole('button', {name: 'Discard'})).toBeTruthy()
  expect(screen.queryByRole('button', {name: 'Retry'})).toBeNull()
  view.unmount()
})

test('shows a media upload as one filename-based activity', async () => {
  const {db, parent, store} = await createDashboardAtomFixture()
  const timestamp = Date.now()
  Object.assign(db, {
    async activities() {
      return [
        {
          id: 'media-upload',
          type: 'mutation',
          status: 'succeeded',
          target: {
            workspace: parent._workspace,
            root: parent._root,
            entry: parent._id,
            locale: null
          },
          operations: [
            {
              op: 'uploadFile',
              title: '26711.3IAxi1mp4Q7dGZkn0KVYL3wDRzo.jpg'
            },
            {op: 'create', title: '26711'}
          ],
          startedAt: timestamp - 10,
          finishedAt: timestamp
        }
      ]
    }
  })

  const view = render(
    <Provider store={store}>
      <ActivityStatus />
    </Provider>
  )

  const button = await screen.findByRole('button', {
    name: 'Content is up to date'
  })
  fireEvent.click(button)

  expect(await screen.findByText('26711.jpg')).toBeTruthy()
  expect(screen.queryByText('2 entries')).toBeNull()
  expect(screen.getByText(/Uploaded file\./)).toBeTruthy()
  expect(screen.getByText('Uploaded')).toBeTruthy()

  fireEvent.click(screen.getByRole('button', {name: /26711\.jpg/}))
  expect(store.get(routeAtom)).toEqual({
    page: 'entry',
    workspace: parent._workspace,
    root: parent._root,
    entry: parent._id,
    locale: undefined,
    view: undefined
  })
  view.unmount()
})

test('shows the progress of a background sync', async () => {
  const {store} = await createDashboardAtomFixture()
  const events = store.get(eventsAtom)
  const view = render(
    <Provider store={store}>
      <ActivityStatus />
    </Provider>
  )
  await screen.findByRole('button', {name: 'Content is up to date'})

  act(() => {
    events.dispatchEvent(new SyncEvent({loaded: 30, total: 120}))
  })
  expect(screen.getByRole('button', {name: 'Syncing content'})).toBeTruthy()
  const spinner = await screen.findByRole('progressbar', {
    name: 'Syncing content'
  })
  expect(spinner.getAttribute('aria-valuenow')).toBe('25')

  act(() => {
    events.dispatchEvent(new SyncEvent())
  })
  view.unmount()
})
