import {cleanup, render, screen} from '#test/react.js'
import type {EntryActionProps} from '#/core/DashboardEntry.js'
import type {Entry} from '#/core/Entry.js'
import {Type} from '#/core/Type.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {useFieldValue} from '#/cms.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {afterEach, expect, test} from 'bun:test'
import {ReactiveNode} from '../atoms/ReactiveNode.js'
import {DashboardScopeInternal} from '../hooks.js'
import {EntryActions} from './EntryActions.js'

afterEach(cleanup)

function ExportAction({entry, locale}: EntryActionProps) {
  const title = useFieldValue(Post.title)
  return (
    <button type="button">
      Export {entry.id} {title} in {locale}
    </button>
  )
}

const Post = Config.document('Post', {
  fields: {title: Field.text('Title')},
  actions: [ExportAction]
})

test('renders the actions of a type with the entry and its fields', () => {
  const config = Config.create({
    schema: {Post},
    workspaces: {
      main: Config.workspace('Main', {
        source: '.',
        roots: {pages: Config.root('Pages', {contains: ['Post']})}
      })
    }
  })
  const graph = new LocalDB(config)
  const dashboard = {
    graph,
    config,
    events: new EventTarget(),
    client: createTestConnection(graph)
  }
  const entry = {id: 'hello', type: 'Post', data: {}} as unknown as Entry
  render(
    <DashboardScopeInternal dashboard={dashboard}>
      <EntryActions
        type={Post}
        node={new ReactiveNode<object>({title: 'Hello'})}
        entry={entry}
        locale="en"
      />
    </DashboardScopeInternal>
  )
  expect(screen.getByText('Export hello Hello in en')).toBeDefined()
})

test('bundles the actions that reference a view module', () => {
  const Page = Config.document('Page', {
    fields: {},
    actions: ['@/views/ExportAction']
  })
  expect(Type.referencedViews(Page)).toContain('@/views/ExportAction')
})
