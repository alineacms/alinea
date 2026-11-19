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

test('the option without a condition shows picked while no other is', () => {
  const usage = {
    key: 'usage',
    label: 'Usage',
    multiple: false,
    options: [
      {key: 'all', label: 'All'},
      {key: 'unused', label: 'Unused', filter: {}}
    ]
  }
  const menu = (picked: Record<string, Array<string>>) => (
    <ExplorerControlsMenu
      sorts={[]}
      sort={undefined}
      filters={[usage]}
      picked={picked}
      onSort={() => {}}
      onToggleFilter={() => {}}
      onReset={() => {}}
    />
  )
  const pressed = () =>
    screen
      .getAllByRole('button')
      .filter(button => button.getAttribute('aria-pressed') === 'true')
      .map(button => button.textContent)
  const {rerender} = render(menu({}))
  expect(pressed()).toEqual(['All'])
  rerender(menu({usage: ['unused']}))
  expect(pressed()).toEqual(['Unused'])
})
