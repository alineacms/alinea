import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {ExplorerControlsMenu} from './ExplorerControls.js'

afterEach(cleanup)

test('filters without options are left out', () => {
  render(
    <ExplorerControlsMenu
      sorts={[]}
      sort={undefined}
      filters={[
        {
          key: 'brand',
          label: 'Brand',
          multiple: false,
          options: [{key: 'acme', label: 'Acme', filter: {}}]
        },
        {key: 'category', label: 'Category', multiple: false, options: []}
      ]}
      picked={{}}
      onSort={() => {}}
      onToggleFilter={() => {}}
      onReset={() => {}}
    />
  )
  expect(screen.queryByRole('group', {name: 'Brand'})).not.toBeNull()
  expect(screen.queryByRole('group', {name: 'Category'})).toBeNull()
})
