import {cleanup, render, screen} from '#test/react.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import type {
  OverviewColumnState,
  OverviewRow
} from '#/dashboard/atoms/overview.js'
import {afterEach, expect, test} from 'bun:test'
import {createStore, Provider} from 'jotai'
import {cms} from '../fixture/cms.js'
import {OverviewCell} from './OverviewCell.js'

afterEach(cleanup)

const column: OverviewColumnState = {
  key: 'related',
  header: 'Related',
  width: '1fr',
  collapsible: false
}

function row(related: unknown): OverviewRow {
  return {
    id: 'page',
    type: 'Page',
    title: 'Page',
    path: 'page',
    locale: null,
    workspace: 'main',
    root: 'pages',
    parentId: null,
    data: {},
    columns: {related}
  }
}

test('linked entries truncate their own text', () => {
  const store = createStore()
  store.set(configAtom, cms.config)
  render(
    <Provider store={store}>
      <OverviewCell
        column={column}
        row={row([
          {id: 'about', title: 'About this website and the people behind it'},
          {id: 'news', title: 'News'}
        ])}
      />
    </Provider>
  )
  const about = screen.getByRole('button', {
    name: 'About this website and the people behind it'
  })
  const text = about.firstElementChild
  expect(text?.tagName).toBe('SPAN')
  expect(text?.textContent).toBe('About this website and the people behind it')
  expect(screen.getByRole('button', {name: 'News'}).textContent).toBe('News')
})
