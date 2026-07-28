import {act, cleanup, render, screen} from '#test/react.js'
import type {LocalConnection} from '#/core/Connection.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {useAtomValue} from 'jotai'
import {afterEach, expect, test} from 'bun:test'
import {DashboardScopeInternal} from './hooks.js'
import {configAtom, createStore, entryRevisionAtom} from './atoms/Dashboard.js'
import {useDashboard} from './hooks.js'

afterEach(cleanup)

function DashboardWorkspace() {
  const config = useAtomValue(configAtom)
  return <span>{Object.keys(config.workspaces)[0]}</span>
}

test('dashboard scopes isolate hydrated atom values', () => {
  const first = createDashboard('first')
  const second = createDashboard('second')

  render(
    <>
      <DashboardScopeInternal dashboard={first}>
        <DashboardWorkspace />
      </DashboardScopeInternal>
      <DashboardScopeInternal dashboard={second}>
        <DashboardWorkspace />
      </DashboardScopeInternal>
    </>
  )

  expect(screen.getByText('first')).toBeDefined()
  expect(screen.getByText('second')).toBeDefined()
})

function DashboardIdentity({
  expected
}: {
  expected: ReturnType<typeof createDashboard>
}) {
  return (
    <span>{useDashboard() === expected ? 'same dashboard' : 'different'}</span>
  )
}

test('useDashboard returns the dashboard from the nearest scope', () => {
  const dashboard = createDashboard('main')

  render(
    <DashboardScopeInternal dashboard={dashboard}>
      <DashboardIdentity expected={dashboard} />
    </DashboardScopeInternal>
  )

  expect(screen.getByText('same dashboard')).toBeDefined()
})

function DashboardRevision() {
  const revision = useAtomValue(entryRevisionAtom('entry'))
  return <span>revision:{revision}</span>
}

test('dashboard effects update entry revisions', () => {
  const events = new TestEvents()
  render(
    <DashboardScopeInternal
      dashboard={createDashboard('main', events as unknown as EventTarget)}
    >
      <DashboardRevision />
    </DashboardScopeInternal>
  )

  act(() => {
    events.emit(new IndexEvent({op: 'entry', id: 'entry'}))
  })

  expect(screen.getByText('revision:1')).toBeDefined()
})

class TestEvents {
  listeners = new Set<EventListenerOrEventListenerObject>()

  addEventListener(
    _type: string,
    listener: EventListenerOrEventListenerObject
  ) {
    this.listeners.add(listener)
  }

  removeEventListener(
    _type: string,
    listener: EventListenerOrEventListenerObject
  ) {
    this.listeners.delete(listener)
  }

  emit(event: Event) {
    for (const listener of this.listeners) {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
  }
}

function createDashboard(workspace: string, events = new EventTarget()) {
  return createStore(
    {} as WriteableGraph,
    {schema: {}, workspaces: {[workspace]: {} as never}},
    events,
    {} as LocalConnection,
    {}
  )
}
