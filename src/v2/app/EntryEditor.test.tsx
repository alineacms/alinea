import {suite} from '@alinea/suite'
import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'
import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import {render, waitFor, within} from '@testing-library/react'
import {v2Views} from '../fields/views.js'
import {EntryEditor} from './EntryEditor.js'

const test = suite(import.meta)

const Article = Config.document('Article', {
  fields: {
    title: Field.text('Title', {width: 0.5, required: true}),
    path: Field.path('Path', {width: 0.5}),
    summary: Field.text('Summary', {help: 'Used in social cards'}),
    featured: Field.check('Featured', {
      width: 0.5,
      description: 'Show in hero'
    }),
    category: Field.select('Category', {
      width: 0.5,
      options: {docs: 'Docs', news: 'News'},
      initialValue: 'docs'
    })
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
  const view = render(
    <EntryEditor
      graph={graph}
      config={cms.config}
      workspace="main"
      root="pages"
      locale={undefined}
      entry={undefined}
      views={v2Views}
    />
  )
  const scope = within(view.container)
  test.is(Boolean(scope.queryByText('Select an entry to edit.')), true)
})

test('renders mapped field implementations for the selected entry type', async () => {
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
      summary: 'A short summary',
      featured: true,
      category: 'news'
    }
  })

  const view = render(
    <EntryEditor
      graph={graph}
      config={cms.config}
      workspace="main"
      root="pages"
      locale={undefined}
      entry="article-1"
      views={v2Views}
    />
  )
  const scope = within(view.container)

  await waitFor(() => {
    test.is(
      Boolean(scope.queryByRole('heading', {level: 2, name: 'Welcome'})),
      true
    )
  })

  test.is(scope.getAllByText('Title').length > 0, true)
  test.is(scope.getAllByText('Path').length > 0, true)
  test.is(scope.getAllByText('Summary').length > 0, true)
  test.is(scope.getAllByText('Featured').length > 0, true)
  test.is(scope.getAllByText('Category').length > 0, true)
  test.is(Boolean(scope.queryByText('Required')), true)
  test.is(Boolean(scope.queryByText('Used in social cards')), true)
  test.is(Boolean(scope.queryByText('Show in hero')), true)
  test.is(scope.getAllByText('50%').length >= 2, true)
  test.is(scope.getAllByText('TextInput').length >= 1, true)
  test.is(Boolean(scope.queryByText('CheckInput')), true)
  test.is(Boolean(scope.queryByText('SelectInput')), true)
  test.is(Boolean(scope.queryByText('PathInput')), true)
  test.is(Boolean(scope.queryByRole('checkbox', {name: 'Featured'})), true)
  test.is(scope.getAllByText('News').length > 0, true)
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

  const view = render(
    <EntryEditor
      graph={graph}
      config={cms.config}
      workspace="main"
      root="pages"
      locale={undefined}
      entry="welcome"
      views={v2Views}
    />
  )
  const scope = within(view.container)

  await waitFor(() => {
    test.is(Boolean(scope.queryByText('Welcome')), true)
  })

  test.is(seenRequests.length >= 2, true)
  test.is(seenRequests[0]?.id, 'welcome')
  test.is(seenRequests[1]?.path, 'welcome')
})
