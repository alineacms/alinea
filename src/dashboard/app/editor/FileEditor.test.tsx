import {cleanup, render, screen} from '#test/react.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {EntryEditor} from '#/dashboard/atoms/editor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {DashboardScopeInternal, EditorScope} from '#/dashboard/hooks.js'
import {Config} from '#/index.js'
import {afterEach, expect, test} from 'bun:test'
import {FileEditor} from './FileEditor.js'

afterEach(cleanup)

test('shows the resolved media URL', () => {
  const config = Config.create({
    baseUrl: 'https://example.test',
    schema: {},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        mediaUrl: ({path, extension}) => `/images/${path}${extension}`,
        roots: {media: Config.media()}
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
  const node = new ReactiveNode<object>({
    extension: '.pdf',
    focus: undefined,
    height: undefined,
    location: '/media/stored-file.pdf',
    path: 'guide',
    preview: '',
    size: 128,
    thumbHash: undefined,
    width: undefined
  })
  const editor = new EntryEditor(MediaFile, node)

  render(
    <DashboardScopeInternal dashboard={dashboard}>
      <EditorScope editor={editor}>
        <FileEditor entry={{root: 'media', url: '/guide', workspace: 'main'}} />
      </EditorScope>
    </DashboardScopeInternal>
  )

  const link = screen.getByRole('link', {name: '/images/guide.pdf'})
  expect(link.getAttribute('href')).toBe(
    'https://example.test/images/guide.pdf'
  )
})
