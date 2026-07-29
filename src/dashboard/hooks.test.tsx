import {act, cleanup, render, screen} from '#test/react.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {Config} from '#/index.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {TestEvents} from '#test/DashboardFixture.js'
import {useAtomValue} from 'jotai'
import {afterEach, expect, test} from 'bun:test'
import {DashboardScopeInternal} from './hooks.js'
import {configAtom} from './atoms/WorkspaceAtoms.js'
import {createDashboard} from './atoms/Dashboard.js'
import {entryRevisionAtom} from './atoms/EntrySupport.js'
import {useDashboard} from './hooks.js'

afterEach(cleanup)

function DashboardWorkspace() {
  const config = useAtomValue(configAtom)
  return <span>{Object.keys(config.workspaces)[0]}</span>
}

test('dashboard scopes isolate hydrated atom values', () => {
  const first = createTestDashboard('first')
  const second = createTestDashboard('second')

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
  expected: ReturnType<typeof createTestDashboard>
}) {
  return (
    <span>{useDashboard() === expected ? 'same dashboard' : 'different'}</span>
  )
}

test('useDashboard returns the nearest dashboard input', () => {
  const dashboard = createTestDashboard('main')

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
    <DashboardScopeInternal dashboard={createTestDashboard('main', events)}>
      <DashboardRevision />
    </DashboardScopeInternal>
  )

  act(() => {
    events.emit(new IndexEvent({op: 'entry', id: 'entry'}))
  })

  expect(screen.getByText('revision:1')).toBeDefined()
})

function createTestDashboard(workspace: string, events = new EventTarget()) {
  const config = Config.create({
    schema: {},
    workspaces: {
      [workspace]: Config.workspace(workspace, {source: '.', roots: {}})
    }
  })
  const db = new LocalDB(config)
  return createDashboard(db, config, events, createTestConnection(db), {})
}
