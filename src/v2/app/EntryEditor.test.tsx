import {suite} from '@alinea/suite'
import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'
import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import {render, screen, waitFor} from '@testing-library/react'
import {EntryEditor} from './EntryEditor.js'

const test = suite(import.meta)

const Article = Config.document('Article', {
  fields: {
    title: Field.text('Title', {width: 0.5, required: true}),
    path: Field.path('Path', {width: 0.5}),
    summary: Field.text('Summary', {help: 'Used in social cards'})
  }
})

const cms = createCMS({
  schema: {Article},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content/main',
      roots: {
        pages: Config.root('Pages', {contains: ['Article']})
      }
    })
  }
})

interface EntryEditorFixture {
  id: string
  title: string
  type: string
  path: string
  status: 'draft' | 'published' | 'archived'
  main: boolean
  locale: string | null
  data: Record<string, unknown>
}

interface FirstRequest {
  id?: string
  path?: string
}

interface GraphOptions {
  disableIdLookup?: boolean
}

function createGraph(entry: EntryEditorFixture | null, options: GraphOptions = {}) {
  const seenRequests: Array<FirstRequest> = []
  const graph = {
    async first(query: unknown) {
      const request = query as FirstRequest
      seenRequests.push(request)
      if (!entry) return null
      if (!options.disableIdLookup && request.id === entry.id) return entry
      if (request.path === entry.path) return entry
      return null
    }
  } as unknown as WriteableGraph
  return {graph, seenRequests}
}

test('renders a hint when no entry is selected', () => {
  const {graph} = createGraph(null)
  render(
    <EntryEditor
      graph={graph}
      config={cms.config}
      workspace="main"
      root="pages"
      locale={undefined}
      entry={undefined}
    />
  )
  test.is(Boolean(screen.queryByText('Select an entry to edit.')), true)
})

test('renders placeholder fields for the selected entry type', async () => {
  const {graph} = createGraph({
    id: 'article-1',
    title: 'Welcome',
    type: 'Article',
    path: 'welcome',
    status: 'published',
    main: true,
    locale: null,
    data: {
      title: 'Welcome',
      path: 'welcome',
      summary: 'A short summary'
    }
  })

  render(
    <EntryEditor
      graph={graph}
      config={cms.config}
      workspace="main"
      root="pages"
      locale={undefined}
      entry="article-1"
    />
  )

  await waitFor(() => {
    test.is(
      Boolean(screen.queryByRole('heading', {level: 2, name: 'Welcome'})),
      true
    )
  })

  test.is(screen.getAllByText('Title').length > 0, true)
  test.is(screen.getAllByText('Path').length > 0, true)
  test.is(screen.getAllByText('Summary').length > 0, true)
  test.is(Boolean(screen.queryByText('Required')), true)
  test.is(Boolean(screen.queryByText('Used in social cards')), true)
  test.is(screen.getAllByText('50%').length >= 2, true)
  test.is(screen.getAllByText('TextInput').length >= 1, true)
  test.is(Boolean(screen.queryByText('PathInput')), true)
})

test('falls back to path lookup when id lookup misses', async () => {
  const {graph, seenRequests} = createGraph(
    {
      id: 'article-1',
      title: 'Welcome',
      type: 'Article',
      path: 'welcome',
      status: 'published',
      main: true,
      locale: null,
      data: {}
    },
    {disableIdLookup: true}
  )

  render(
    <EntryEditor
      graph={graph}
      config={cms.config}
      workspace="main"
      root="pages"
      locale={undefined}
      entry="welcome"
    />
  )

  await waitFor(() => {
    test.is(Boolean(screen.queryByText('Welcome')), true)
  })

  test.is(seenRequests.length >= 2, true)
  test.is(seenRequests[0]?.id, 'welcome')
  test.is(seenRequests[1]?.path, 'welcome')
})
