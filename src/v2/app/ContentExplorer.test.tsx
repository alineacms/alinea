import {suite} from '@alinea/suite'
import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'
import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import {render, waitFor} from '@testing-library/react'
import {ContentExplorer} from './ContentExplorer.js'

const test = suite(import.meta)

const Folder = Config.document('Folder', {
  contains: ['Folder', 'Leaf'],
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path')
  }
})

const Leaf = Config.document('Leaf', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path')
  }
})

const cms = createCMS({
  schema: {Folder, Leaf},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content/main',
      roots: {
        pages: Config.root('Pages', {contains: ['Folder', 'Leaf']})
      }
    })
  }
})

interface EntryNode {
  id: string
  path: string
  title: string
  type: string
  parentId: string | null
}

interface FirstQuery {
  id?: string
  path?: string
}

interface CountQuery {
  parentId?: string | null
}

function createGraph(entries: Array<EntryNode>) {
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  const byPath = new Map(entries.map(entry => [entry.path, entry]))
  const seenParentIds: Array<string | null | undefined> = []

  const graph = {
    async first(query: unknown) {
      const request = query as FirstQuery
      if (request.id) {
        const entry = byId.get(request.id)
        if (!entry) return null
        return {
          id: entry.id,
          title: entry.title,
          type: entry.type,
          parentId: entry.parentId
        }
      }
      if (request.path) {
        const entry = byPath.get(request.path)
        if (!entry) return null
        return {
          id: entry.id,
          title: entry.title,
          type: entry.type,
          parentId: entry.parentId
        }
      }
      return null
    },
    async count(query: unknown) {
      const request = query as CountQuery
      seenParentIds.push(request.parentId)
      return 0
    },
    async find() {
      return []
    }
  } as unknown as WriteableGraph

  return {graph, seenParentIds}
}

test('reports selected container title to the header callback', async () => {
  const {graph, seenParentIds} = createGraph([
    {
      id: 'folder-1',
      path: 'folder-1',
      title: 'Folder',
      type: 'Folder',
      parentId: null
    }
  ])
  const titles: Array<string> = []

  render(
    <ContentExplorer
      graph={graph}
      config={cms.config}
      workspace="main"
      root="pages"
      entry="folder-1"
      virtualized={false}
      autoLoadMore={false}
      onOpenEntry={function onOpenEntry() {}}
      onScopeTitleChange={function onScopeTitleChange(title) {
        titles.push(title)
      }}
    />
  )

  await waitFor(() => {
    test.is(titles[titles.length - 1], 'Folder')
  })
  test.is(seenParentIds[0], 'folder-1')
})

test('falls back to parent scope for selected entries without child support', async () => {
  const {graph, seenParentIds} = createGraph([
    {
      id: 'folder-1',
      path: 'folder-1',
      title: 'Folder',
      type: 'Folder',
      parentId: null
    },
    {
      id: 'leaf-1',
      path: 'leaf-1',
      title: 'Leaf',
      type: 'Leaf',
      parentId: 'folder-1'
    }
  ])
  const titles: Array<string> = []

  render(
    <ContentExplorer
      graph={graph}
      config={cms.config}
      workspace="main"
      root="pages"
      entry="leaf-1"
      virtualized={false}
      autoLoadMore={false}
      onOpenEntry={function onOpenEntry() {}}
      onScopeTitleChange={function onScopeTitleChange(title) {
        titles.push(title)
      }}
    />
  )

  await waitFor(() => {
    test.is(titles[titles.length - 1], 'Folder')
  })
  test.is(seenParentIds[0], 'folder-1')
})
