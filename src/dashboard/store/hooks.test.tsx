import '../dom.js'
import {suite} from '@alinea/suite'
import {cleanup, fireEvent, render} from '@testing-library/react'
import {atom, Provider, useAtomValue, useSetAtom} from 'jotai'
import {createStore} from 'jotai/vanilla'
import {act, Suspense} from 'react'
import type {Entry as EntryRecord} from '#/core/Entry.js'
import type {Policy} from '#/core/Role.js'
import {
  DashboardEntryData,
  type Dashboard,
  type DashboardEntry
} from './Dashboard.js'
import {DashboardScopeInternal, EntryScope, useEntry, useGraphQuery} from './hooks.js'

interface ReactActGlobal {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

(globalThis as typeof globalThis & ReactActGlobal).IS_REACT_ACT_ENVIRONMENT =
  true

const test = suite(import.meta)

function entry(
  overrides: Partial<EntryRecord<Record<string, unknown>>> = {}
): EntryRecord<Record<string, unknown>> {
  return {
    active: true,
    childrenDir: 'pages/home',
    data: {title: 'Home'},
    fileHash: 'file-hash',
    filePath: 'pages/home.json',
    id: 'home',
    index: '0001',
    level: 0,
    locale: null,
    main: true,
    parentDir: 'pages',
    parentId: null,
    parents: [],
    path: 'home',
    root: 'pages',
    rowHash: 'row-hash',
    searchableText: 'Home',
    seeded: null,
    status: 'published',
    title: 'Home',
    type: 'Page',
    url: '/home',
    workspace: 'main',
    ...overrides
  }
}

test('useEntry returns null without an entry scope', () => {
  function View() {
    const current = useEntry()
    return <div>{current ? current.id : 'none'}</div>
  }

  const view = render(<View />)

  view.getByText('none')
  cleanup()
})

test('useEntry reads and updates the scoped current entry atom', () => {
  const currentEntry = atom<EntryRecord<Record<string, unknown>> | null>(
    entry()
  )
  const entryModel = {currentEntry} as unknown as DashboardEntryData

  function View() {
    const current = useEntry()
    const setCurrent = useSetAtom(currentEntry)
    return (
      <>
        <div>{current?.title ?? 'none'}</div>
        <button
          type="button"
          onClick={() => setCurrent(entry({id: 'about', title: 'About'}))}
        >
          Switch
        </button>
      </>
    )
  }

  const view = render(
    <EntryScope entry={entryModel}>
      <View />
    </EntryScope>
  )

  view.getByText('Home')
  fireEvent.click(view.getByRole('button', {name: 'Switch'}))
  view.getByText('About')
  cleanup()
})

test('DashboardEntryData currentEntry follows the selected status version', async () => {
  const published = entry({
    status: 'published',
    title: 'Published version'
  })
  const draft = entry({
    filePath: 'pages/home.draft.json',
    status: 'draft',
    title: 'Draft version'
  })
  const data = atom({
    entries: [draft],
    hasChildren: false,
    id: 'home',
    parentId: null,
    parents: [],
    root: 'pages',
    type: 'Page',
    workspace: 'main'
  })
  const versionLoader = atom(() => async () => [[draft, published], null])
  const dashboard = {
    policy: atom({
      canRead() {
        return true
      }
    } as Partial<Policy>),
    revisions() {
      return atom(0)
    },
    type() {
      return atom({type: {}})
    },
    versionLoader,
    workspace() {
      return {
        root() {
          return {selectedLocale: atom<string | null>(null)}
        }
      }
    }
  }
  const model = new DashboardEntryData(
    {dashboard, id: 'home'} as unknown as DashboardEntry,
    data
  )
  const store = createStore()

  store.set(model.selectedVersion, {type: 'status', status: 'published'})
  const selectedPublished = await store.get(model.currentEntry)
  test.equal(selectedPublished?.title, 'Published version')

  store.set(model.selectedVersion, {type: 'status', status: 'draft'})
  const selectedDraft = await store.get(model.currentEntry)
  test.equal(selectedDraft?.title, 'Draft version')
})

test('useGraphQuery refreshes when dependencies change', async () => {
  const label = atom('First')
  const dashboard = {
    config: atom({}),
    db: atom({}),
    policy: atom({}),
    sha: atom('sha'),
    user: atom(null)
  } as unknown as Dashboard

  function View() {
    const currentLabel = useAtomValue(label)
    const setLabel = useSetAtom(label)
    const result = useGraphQuery(() => currentLabel, [currentLabel])
    return (
      <>
        <div>{result}</div>
        <button type="button" onClick={() => setLabel('Second')}>
          Switch
        </button>
      </>
    )
  }

  let view!: ReturnType<typeof render>
  await act(async () => {
    view = render(
      <Provider store={createStore()}>
        <DashboardScopeInternal dashboard={dashboard}>
          <Suspense fallback={<div>Loading</div>}>
            <View />
          </Suspense>
        </DashboardScopeInternal>
      </Provider>
    )
  })

  await view.findByText('First')
  await act(async () => {
    fireEvent.click(view.getByRole('button', {name: 'Switch'}))
  })
  await view.findByText('Second')
  cleanup()
})
