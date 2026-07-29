import {act, cleanup, render, screen} from '#test/react.js'
import type {Entry} from '#/core/Entry.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {Config} from '#/index.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {TestEvents} from '#test/DashboardFixture.js'
import {useAtomValue} from 'jotai'
import {afterEach, expect, test} from 'bun:test'
import {
  DashboardScopeInternal,
  EntryScope,
  useDashboard,
  useEntry
} from './hooks.js'
import {configAtom} from './atoms/WorkspaceAtoms.js'
import {createDashboard} from './atoms/Dashboard.js'
import {entryRevisionAtom} from './atoms/EntrySupport.js'

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

test('useDashboard returns the nearest dashboard model', () => {
  const dashboard = createTestDashboard('main')

  render(
    <DashboardScopeInternal dashboard={dashboard}>
      <DashboardIdentity expected={dashboard} />
    </DashboardScopeInternal>
  )

  expect(screen.getByText('same dashboard')).toBeDefined()
})

function EntryTitle() {
  return <span>{useEntry()?.title ?? 'no entry'}</span>
}

test('useEntry returns the plain entry from the nearest entry scope', () => {
  const entry: Entry = {
    active: true,
    childrenDir: '',
    data: {},
    fileHash: '',
    filePath: '',
    id: 'entry',
    index: '0',
    level: 0,
    locale: null,
    main: true,
    parentDir: '',
    parentId: null,
    parents: [],
    path: 'entry',
    root: 'pages',
    rowHash: '',
    searchableText: '',
    seeded: null,
    status: 'published',
    title: 'Scoped entry',
    type: 'Page',
    url: '/entry',
    workspace: 'main'
  }

  render(
    <>
      <EntryTitle />
      <EntryScope entry={entry}>
        <EntryTitle />
      </EntryScope>
    </>
  )

  expect(screen.getByText('no entry')).toBeDefined()
  expect(screen.getByText('Scoped entry')).toBeDefined()
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
