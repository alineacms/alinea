import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {DashboardScopeInternal} from '#/dashboard/hooks.js'
import {createDashboard} from '#/dashboard/atoms/DashboardModel.js'
import type {EntryDataState} from '#/dashboard/atoms/EntryAtoms.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {EntrySidebarPreview} from './EntrySidebarPreview.js'

interface PreviewGraph {
  sync(): Promise<string>
}

const graph = {
  sync() {
    return Promise.resolve('preview-content-sha')
  }
} satisfies PreviewGraph as unknown as WriteableGraph

const dashboard = createDashboard(
  graph,
  {schema: {}, workspaces: {}},
  new EventTarget(),
  {} as LocalConnection,
  {}
)

const node = new ReactiveNode({title: 'Original title'})
const previewPayloadSignal = atom(get => get(node.value))
const entry = {
  preview: atom(true),
  previewUrl: atom('/preview-frame'),
  previewPayloadSignal,
  updatePreviewPayload: atom(null, async get => {
    const sha = await get(dashboard.sha)
    if (!sha) return undefined
    return JSON.stringify({sha, data: get(node.value)})
  }),
  retryPreviewUrl: atom(null, () => {})
} as unknown as EntryDataState
const sidebar = {type: 'preview', entry: null, url: '/preview-frame'} as const

function PreviewTitleField() {
  const titleField = node.field('title')
  const value = useAtomValue(titleField)
  const setValue = useSetAtom(titleField)
  return (
    <label>
      Title
      <input
        aria-label="Title"
        value={typeof value === 'string' ? value : ''}
        onChange={event => setValue(event.currentTarget.value)}
      />
    </label>
  )
}

export function EntrySidebarPreviewStory() {
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <PreviewTitleField />
      <EntrySidebarPreview entry={entry} sidebar={sidebar} />
    </DashboardScopeInternal>
  )
}
