import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {act, cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Provider, useAtom, useAtomValue} from 'jotai'
import {useEffect} from 'react'
import {appAtom} from '../App.js'
import {
  activityAtom,
  activityPendingAtom,
  uploadProgressAtom
} from '../atoms/activity.js'
import {eventsAtom} from '../atoms/core.js'
import {routeAtom} from '../atoms/nav.js'
import {ActivityEvent} from '../boot/ActivityEvent.js'
import {
  ActivityStatus as ActivityStatusView,
  type ActivityStatusProps
} from './ActivityStatus.js'

afterEach(cleanup)

function AppSubscription() {
  useAtomValue(appAtom)
  return null
}

function ActivityPendingSubscription() {
  const [appPending] = useAtomValue(appAtom)
  const activity = useAtomValue(activityAtom)
  const [, setActivityPending] = useAtom(activityPendingAtom)
  const pending =
    appPending || activity.isFetchingUpdates || activity.isMutating
  useEffect(() => {
    setActivityPending(pending)
  }, [pending, setActivityPending])
  return null
}

function ActivityStatus(props: ActivityStatusProps) {
  return (
    <>
      <ActivityPendingSubscription />
      <ActivityStatusView {...props} />
    </>
  )
}

test('shows a loader while the worker is fetching updates', async () => {
  const {db, store} = await createDashboardAtomFixture()
  Object.assign(db, {
    async activities() {
      return [
        {
          id: 'fetch',
          type: 'fetch',
          status: 'running',
          operations: [],
          startedAt: Date.now()
        }
      ]
    }
  })

  const view = render(
    <Provider store={store}>
      <ActivityPendingSubscription />
      <ActivityStatusView />
    </Provider>
  )

  expect(
    await screen.findByRole('button', {name: 'Fetching updates'})
  ).toBeTruthy()
  expect(
    await screen.findByRole('progressbar', {name: 'Fetching updates'})
  ).toBeTruthy()
  view.unmount()
})

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

test('suppresses short activity and holds a visible spinner', async () => {
  const {db, store} = await createDashboardAtomFixture()
  Object.assign(db, {
    async activities() {
      return []
    }
  })
  const events = store.get(eventsAtom)
  const timestamp = Date.now()
  const running = {
    id: 'buffered-fetch',
    type: 'fetch' as const,
    status: 'running' as const,
    operations: [],
    startedAt: timestamp
  }

  const view = render(
    <Provider store={store}>
      <ActivityPendingSubscription />
      <ActivityStatusView />
    </Provider>
  )
  const button = await screen.findByRole('button', {
    name: 'Content is up to date'
  })
  fireEvent.click(button)

  act(() => events.dispatchEvent(new ActivityEvent([running])))
  expect(
    screen.queryByRole('progressbar', {name: 'Fetching updates'})
  ).toBeNull()
  await pause(50)
  act(() =>
    events.dispatchEvent(
      new ActivityEvent([
        {...running, status: 'succeeded', finishedAt: Date.now()}
      ])
    )
  )
  await pause(100)
  expect(
    screen.queryByRole('progressbar', {name: 'Fetching updates'})
  ).toBeNull()

  act(() => events.dispatchEvent(new ActivityEvent([running])))
  expect(
    await screen.findByRole('progressbar', {name: 'Fetching updates'})
  ).toBeTruthy()
  act(() =>
    events.dispatchEvent(
      new ActivityEvent([
        {...running, status: 'succeeded', finishedAt: Date.now()}
      ])
    )
  )
  view.rerender(
    <Provider store={store}>
      <ActivityPendingSubscription />
      <ActivityStatusView key="replacement" />
    </Provider>
  )
  expect(screen.getByRole('button', {name: 'Finishing up'})).toBeTruthy()
  expect(screen.getByRole('progressbar')).toBeTruthy()
  await pause(800)
  expect(screen.getByRole('progressbar')).toBeTruthy()
  await pause(250)
  expect(screen.queryByRole('progressbar')).toBeNull()
  view.unmount()
})

test('does not restore an expired spinner after an unmounted route', async () => {
  const {db, store} = await createDashboardAtomFixture()
  Object.assign(db, {
    async activities() {
      return []
    }
  })
  const events = store.get(eventsAtom)
  const running = {
    id: 'expired-fetch',
    type: 'fetch' as const,
    status: 'running' as const,
    operations: [],
    startedAt: Date.now()
  }
  const view = render(
    <Provider store={store}>
      <AppSubscription />
      <ActivityPendingSubscription />
      <ActivityStatusView />
    </Provider>
  )

  await screen.findByRole('button', {name: 'Content is up to date'})
  act(() => events.dispatchEvent(new ActivityEvent([running])))
  expect(await screen.findByRole('progressbar')).toBeTruthy()
  act(() =>
    events.dispatchEvent(
      new ActivityEvent([
        {...running, status: 'succeeded', finishedAt: Date.now()}
      ])
    )
  )
  view.rerender(
    <Provider store={store}>
      <AppSubscription />
      <ActivityPendingSubscription />
    </Provider>
  )
  await pause(1050)
  view.rerender(
    <Provider store={store}>
      <AppSubscription />
      <ActivityPendingSubscription />
      <ActivityStatusView />
    </Provider>
  )

  expect(screen.queryByRole('progressbar')).toBeNull()
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

test('keeps fetching updates visible alongside failed actions', async () => {
  const {db, store} = await createDashboardAtomFixture()
  const startedAt = Date.now()
  Object.assign(db, {
    async activities() {
      return [
        {
          id: 'fetch',
          type: 'fetch',
          status: 'running',
          operations: [],
          startedAt
        },
        {
          id: 'failed-change',
          type: 'mutation',
          status: 'failed',
          error: 'Could not save changes',
          operations: [{op: 'update', title: 'Page'}],
          startedAt: startedAt - 1,
          finishedAt: startedAt
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
    name: 'Fetching updates; some actions failed'
  })
  expect(
    await screen.findByRole('progressbar', {
      name: 'Fetching updates; some actions failed'
    })
  ).toBeTruthy()

  fireEvent.click(button)
  expect(await screen.findByText(/Checking for content changes\./)).toBeTruthy()
  expect(screen.getByText('Could not save changes')).toBeTruthy()
  view.unmount()
})

async function pause(duration: number) {
  await act(() => new Promise<void>(resolve => setTimeout(resolve, duration)))
}

test('shows completed activity history', async () => {
  const {db, store} = await createDashboardAtomFixture()
  const timestamp = Date.now()
  Object.assign(db, {
    async activities() {
      return [
        {
          id: 'fetch',
          type: 'fetch',
          status: 'succeeded',
          operations: [],
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

  expect(await screen.findByText('Checked for updates')).toBeTruthy()
  expect(screen.getByText('Up to date')).toBeTruthy()
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
