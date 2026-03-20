import {act, fireEvent, render} from '@testing-library/react'
import {Config} from 'alinea'
import {createCMS} from 'alinea/core'
import {TestDB} from 'alinea/core/db/TestDB.js'
import {expect, test} from 'bun:test'
import 'alinea/v2/dom.js'
import {Dashboard} from 'alinea/v2/store'
import {atom, createStore, Provider} from 'jotai'
import {ExplorerList} from './ExplorerList.js'

const Article = Config.document('Article', {
  fields: {}
})

async function renderExplorerList(options?: {
  view?: 'card' | 'row'
  withParent?: boolean
}) {
  const cms = createCMS({
    schema: {Article},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {
          pages: Config.root('Pages')
        }
      })
    }
  })

  const db = new TestDB(cms.config)
  const store = createStore()
  const dashboard = new Dashboard(atom(db), atom(cms.config), atom(db), atom({}))
  const explorer = dashboard.explore({workspace: 'main', root: 'pages'})

  const first = await db.create({
    type: Article,
    root: 'pages',
    set: {title: 'First entry', path: 'first-entry'}
  })

  if (options?.withParent) {
    await db.create({
      type: Article,
      root: 'pages',
      parentId: first._id,
      set: {title: 'Nested entry', path: 'nested-entry'}
    })
  }

  if (options?.view) store.set(explorer.view, options.view)

  const view = render(
    <Provider store={store}>
      <div style={{height: '480px'}}>
        <ExplorerList explorer={explorer} />
      </div>
    </Provider>
  )

  return {explorer, first, store, view}
}

test('renders explorer items inside the virtualized viewport', async () => {
  const {view} = await renderExplorerList({view: 'row'})

  await view.findByText('First entry')
  expect(view.getByText('Article')).toBeTruthy()
})

test('selects items by clicking rows in the virtualized list', async () => {
  const {explorer, first, store, view} = await renderExplorerList({view: 'row'})
  const row = await view.findByRole('row', {name: 'First entry'})

  await act(async () => {
    fireEvent.click(row)
  })

  const selection = store.get(explorer.selection)
  expect(selection === 'all' ? [] : Array.from(selection)).toEqual([first._id])
  expect(row.getAttribute('data-selected')).toBe('true')
})

test('activating an entry with children sets the explorer parent', async () => {
  const {explorer, first, store, view} = await renderExplorerList({
    view: 'row',
    withParent: true
  })

  const row = await view.findByRole('row', {name: 'First entry'})

  await act(async () => {
    fireEvent.click(row)
  })

  expect(store.get(explorer.location).parentId).toBe(first._id)
})
