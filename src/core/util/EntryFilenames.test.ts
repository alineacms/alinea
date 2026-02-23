import {suite} from '@alinea/suite'
import {createConfig} from '../Config.js'
import {root} from '../Root.js'
import {workspace} from '../Workspace.js'
import {entryFileName, entryFilepath} from './EntryFilenames.js'

const test = suite(import.meta)

test('entryFilepath includes root and status suffix', () => {
  const config = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {
        source: 'content/main',
        roots: {
          pages: root('Pages')
        }
      })
    }
  })

  const entry = {
    workspace: 'main',
    root: 'pages',
    locale: null,
    path: 'Hello',
    status: 'draft' as const
  }

  test.is(
    entryFilepath(config, entry, ['Blog']),
    'pages/blog/hello.draft.json'
  )
})

test('entryFileName uses source plus filepath without duplicating root', () => {
  const config = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {
        source: 'content/main',
        roots: {
          pages: root('Pages')
        }
      })
    }
  })

  const entry = {
    workspace: 'main',
    root: 'pages',
    locale: null,
    path: 'Hello',
    status: 'published' as const
  }

  test.is(
    entryFileName(config, entry, ['Blog']),
    'content/main/pages/blog/hello.json'
  )
})

test('entryFileName in multiple workspaces resolves from the selected workspace', () => {
  const config = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {
        source: 'content/main',
        roots: {
          pages: root('Pages')
        }
      }),
      docs: workspace('Docs', {
        source: 'content/docs',
        roots: {
          pages: root('Pages')
        }
      })
    }
  })

  const entry = {
    workspace: 'docs',
    root: 'pages',
    locale: null,
    path: 'Guide',
    status: 'published' as const
  }

  test.is(
    entryFileName(config, entry, []),
    'content/docs/pages/guide.json'
  )
  test.is(entryFilepath(config, entry, []), 'pages/guide.json')
})
