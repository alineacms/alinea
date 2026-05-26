import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {Provider, atom} from 'jotai'
import {createStore} from 'jotai/vanilla'
import {afterEach, expect, test} from 'bun:test'
import type {
  DashboardEntryData,
  DashboardEntryReferencesState,
  DashboardRoute
} from '../store.js'
import {EntryReferences} from './EntryReferences.js'

afterEach(cleanup)

test('EntryReferences shows scan progress while loading', () => {
  render(
    <EntryReferences
      entry={entryWithState({
        pending: true,
        data: undefined,
        scan: {scanned: 2, total: 5, complete: false}
      })}
    />
  )

  expect(screen.getByText('Scanning references 2 of 5')).toBeTruthy()
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
        total: 1,
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
  expect(screen.getByText('Related')).toBeTruthy()
  expect(store.get(route)).toEqual({
    workspace: 'main',
    root: 'pages',
    entry: 'source',
    locale: undefined
  })
})

function entryWithState(
  state: DashboardEntryReferencesState,
  route = atom<DashboardRoute>({})
): DashboardEntryData {
  return ({
    incomingReferencesState: atom(state),
    dashboard: {route}
  } as unknown) as DashboardEntryData
}
