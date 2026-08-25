import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {SourceDB} from '#/database/entry/SourceDB.js'
import {Config, Field} from '#/index.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {afterEach, expect, test} from 'bun:test'
import {useAtomValue} from 'jotai'
import {EntryEditor} from './atoms/editor.js'
import {ReactiveNode} from './atoms/ReactiveNode.js'
import {configAtom} from './atoms/core.js'
import {
  DashboardScopeInternal,
  EditorScope,
  useDashboard,
  useField
} from './hooks.js'

const titleField = Field.text('Title')
const Article = Config.document('Article', {
  fields: {title: titleField}
})

afterEach(cleanup)

function FunctionalFieldUpdate() {
  const [value, setValue] = useField(titleField)
  return (
    <button onClick={() => setValue(current => `${current}!`)}>{value}</button>
  )
}

test('useField applies a functional update once', () => {
  const node = new ReactiveNode<object>({title: 'First'})
  const editor = new EntryEditor(Article, node)

  render(
    <EditorScope editor={editor}>
      <FunctionalFieldUpdate />
    </EditorScope>
  )

  fireEvent.click(screen.getByRole('button', {name: 'First'}))
  expect(screen.getByRole('button', {name: 'First!'})).toBeDefined()
})

function DashboardIdentity({expected}: {expected: object}) {
  const dashboard = useDashboard()
  const config = useAtomValue(configAtom)
  return (
    <span>
      {dashboard === expected ? 'same' : 'different'}:
      {Object.keys(config.workspaces)[0]}
    </span>
  )
}

function testDashboard(workspace: string) {
  const config = Config.create({
    schema: {},
    workspaces: {
      [workspace]: Config.workspace(workspace, {source: '.', roots: {}})
    }
  })
  const graph = new SourceDB(config)
  return {
    graph,
    config,
    events: new EventTarget(),
    client: createTestConnection(graph)
  }
}

test('dashboard scopes preserve the public model and isolate atom state', () => {
  const first = testDashboard('first')
  const second = testDashboard('second')

  render(
    <>
      <DashboardScopeInternal dashboard={first}>
        <DashboardIdentity expected={first} />
      </DashboardScopeInternal>
      <DashboardScopeInternal dashboard={second}>
        <DashboardIdentity expected={second} />
      </DashboardScopeInternal>
    </>
  )

  expect(screen.getByText('same:first')).toBeDefined()
  expect(screen.getByText('same:second')).toBeDefined()
})
