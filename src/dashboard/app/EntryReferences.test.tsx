import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {Provider, atom} from 'jotai'
import {createStore} from 'jotai/vanilla'
import {afterEach, expect, test} from 'bun:test'
import {Suspense, act} from 'react'
import type {
  DashboardEntryData,
  DashboardEntryReferencesState,
  DashboardRoute
} from '../store.js'
import {EntryReferences} from './EntryReferences.js'

afterEach(cleanup)

test('EntryReferences shows local loading while initially loading', async () => {
  await act(async () => {
    render(
      <Suspense fallback={<span>Loading editor</span>}>
        <EntryReferences
          entry={entryWithState({
            pending: true,
            data: undefined,
            scan: {scanned: 2, total: 5, complete: false}
          })}
        />
      </Suspense>
    )
  })

  expect(screen.queryByText('Loading editor')).toBeNull()
  expect(screen.getByLabelText('Loading references')).toBeTruthy()
})

test('EntryReferences lists sources and navigates to them', () => {
  const store = createStore()
  const route = atom<DashboardRoute>({})
  const entry = entryWithState(
    {
      pending: false,
      scan: {scanned: 3, total: 3, complete: true},
      data: {
        total: 3,
        scan: {scanned: 3, total: 3, complete: true},
        references: [
          {
            reference: {
              targetId: 'target',
              sourceId: 'source',
              sourceFilePath: 'pages/source.json',
              sourceType: 'Page',
              sourceLocale: null,
              sourceStatus: 'published',
              sourceActive: true,
              sourceMain: true,
              fieldPath: 'related',
              fieldLabel: 'Related',
              linkId: 'related-link',
              linkType: 'entry'
            },
            source: {
              id: 'source',
              title: 'Source entry',
              type: 'Page',
              workspace: 'main',
              root: 'pages',
              locale: null,
              status: 'published',
              path: 'source',
              url: '/source'
            }
          },
          {
            reference: {
              targetId: 'target',
              sourceId: 'source',
              sourceFilePath: 'pages/source.draft.json',
              sourceType: 'Page',
              sourceLocale: null,
              sourceStatus: 'draft',
              sourceActive: true,
              sourceMain: false,
              fieldPath: 'resources',
              fieldLabel: 'Resources',
              linkId: 'resources-link',
              linkType: 'entry'
            },
            source: {
              id: 'source',
              title: 'Source entry',
              type: 'Page',
              workspace: 'main',
              root: 'pages',
              locale: null,
              status: 'draft',
              path: 'source',
              url: '/source'
            }
          },
          {
            reference: {
              targetId: 'target',
              sourceId: 'draft-source',
              sourceFilePath: 'pages/draft-source.draft.json',
              sourceType: 'Page',
              sourceLocale: null,
              sourceStatus: 'draft',
              sourceActive: true,
              sourceMain: false,
              fieldPath: 'related',
              fieldLabel: 'Related',
              linkId: 'draft-related-link',
              linkType: 'entry'
            },
            source: {
              id: 'draft-source',
              title: 'Draft source entry',
              type: 'Page',
              workspace: 'main',
              root: 'pages',
              locale: null,
              status: 'draft',
              path: 'draft-source',
              url: '/draft-source'
            }
          }
        ]
      }
    },
    route
  )

  render(
    <Provider store={store}>
      <EntryReferences entry={entry} />
    </Provider>
  )

  fireEvent.click(screen.getByRole('button', {name: 'Open Source entry'}))

  expect(screen.getByText('Source entry')).toBeTruthy()
  expect(screen.getAllByRole('button')).toHaveLength(2)
  expect(screen.getByText('Related, Resources')).toBeTruthy()
  expect(screen.getByText('Related')).toBeTruthy()
  expect(screen.getByText('Published')).toBeTruthy()
  expect(screen.getAllByText('Draft')).toHaveLength(2)
  expect(store.get(route)).toEqual({
    workspace: 'main',
    root: 'pages',
    entry: 'source',
    locale: undefined
  })
})

test('EntryReferences groups references by source locale', () => {
  const store = createStore()
  const route = atom<DashboardRoute>({})
  const entry = entryWithState(
    {
      pending: false,
      scan: {scanned: 3, total: 3, complete: true},
      data: {
        total: 3,
        scan: {scanned: 3, total: 3, complete: true},
        references: [
          {
            reference: {
              targetId: 'target',
              sourceId: 'source',
              sourceFilePath: 'pages/en/source.json',
              sourceType: 'Page',
              sourceLocale: 'en',
              sourceStatus: 'published',
              sourceActive: true,
              sourceMain: true,
              fieldPath: 'related',
              fieldLabel: 'Related',
              linkId: 'en-related-link',
              linkType: 'entry'
            },
            source: {
              id: 'source',
              title: 'Source entry',
              type: 'Page',
              workspace: 'main',
              root: 'pages',
              locale: 'en',
              status: 'published',
              path: 'source',
              url: '/source'
            }
          },
          {
            reference: {
              targetId: 'target',
              sourceId: 'source',
              sourceFilePath: 'pages/en/source.draft.json',
              sourceType: 'Page',
              sourceLocale: 'en',
              sourceStatus: 'draft',
              sourceActive: true,
              sourceMain: false,
              fieldPath: 'resources',
              fieldLabel: 'Resources',
              linkId: 'en-resources-link',
              linkType: 'entry'
            },
            source: {
              id: 'source',
              title: 'Source entry',
              type: 'Page',
              workspace: 'main',
              root: 'pages',
              locale: 'en',
              status: 'draft',
              path: 'source',
              url: '/source'
            }
          },
          {
            reference: {
              targetId: 'target',
              sourceId: 'source',
              sourceFilePath: 'pages/fr/source.json',
              sourceType: 'Page',
              sourceLocale: 'fr',
              sourceStatus: 'published',
              sourceActive: true,
              sourceMain: true,
              fieldPath: 'related',
              fieldLabel: 'Related',
              linkId: 'fr-related-link',
              linkType: 'entry'
            },
            source: {
              id: 'source',
              title: 'Source entry',
              type: 'Page',
              workspace: 'main',
              root: 'pages',
              locale: 'fr',
              status: 'published',
              path: 'source',
              url: '/source'
            }
          }
        ]
      }
    },
    route,
    'en'
  )

  render(
    <Provider store={store}>
      <EntryReferences entry={entry} />
    </Provider>
  )

  fireEvent.click(screen.getAllByRole('button', {name: 'Open Source entry'})[0])

  expect(screen.getAllByRole('button')).toHaveLength(1)
  expect(screen.getByText('EN')).toBeTruthy()
  expect(screen.getByText('Related, Resources')).toBeTruthy()
  expect(
    screen.getByText('1 reference in other languages: FR (1)')
  ).toBeTruthy()
  expect(store.get(route)).toEqual({
    workspace: 'main',
    root: 'pages',
    entry: 'source',
    locale: 'en'
  })
})

test('EntryReferences shows other locale totals when selected locale is empty', () => {
  const entry = entryWithState(
    {
      pending: false,
      scan: {scanned: 1, total: 1, complete: true},
      data: {
        total: 1,
        scan: {scanned: 1, total: 1, complete: true},
        references: [
          {
            reference: {
              targetId: 'target',
              sourceId: 'source',
              sourceFilePath: 'pages/fr/source.json',
              sourceType: 'Page',
              sourceLocale: 'fr',
              sourceStatus: 'published',
              sourceActive: true,
              sourceMain: true,
              fieldPath: 'related',
              fieldLabel: 'Related',
              linkId: 'fr-related-link',
              linkType: 'entry'
            },
            source: {
              id: 'source',
              title: 'Source entry',
              type: 'Page',
              workspace: 'main',
              root: 'pages',
              locale: 'fr',
              status: 'published',
              path: 'source',
              url: '/source'
            }
          }
        ]
      }
    },
    atom<DashboardRoute>({}),
    'en'
  )

  render(<EntryReferences entry={entry} />)

  expect(screen.queryAllByRole('button')).toHaveLength(0)
  expect(screen.getByText('No incoming references in EN')).toBeTruthy()
  expect(
    screen.getByText('1 reference in other languages: FR (1)')
  ).toBeTruthy()
})

function entryWithState(
  state: DashboardEntryReferencesState,
  route = atom<DashboardRoute>({}),
  selectedLocale: string | null = null
): DashboardEntryData {
  return {
    incomingReferencesState: atom(state),
    incomingReferences: atom(new Promise(() => {})),
    root: atom({
      selectedLocale: atom(selectedLocale)
    }),
    dashboard: {route}
  } as unknown as DashboardEntryData
}
