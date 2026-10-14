import {act, cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {ExplorerTabs} from './ExplorerTabs.js'

afterEach(cleanup)

const tabs = [
  {key: 'all', label: 'All'},
  {key: 'active', label: 'Active', filter: {status: 'active'}},
  {key: 'archived', label: 'Archived', filter: {status: 'archived'}}
]

test('tabs pick the listed entries with the keyboard', () => {
  const picked: Array<string> = []
  render(
    <ExplorerTabs
      tabs={tabs}
      value="active"
      onValueChange={key => picked.push(key)}
    >
      <p>Listed entries</p>
    </ExplorerTabs>
  )
  expect(screen.getByRole('tablist', {name: 'Overview tabs'})).toBeDefined()
  const active = screen.getByRole('tab', {name: 'Active'})
  expect(active.getAttribute('aria-selected')).toBe('true')
  expect(screen.getByRole('tabpanel').textContent).toBe('Listed entries')
  act(() => active.focus())
  fireEvent.keyDown(active, {key: 'ArrowRight'})
  expect(picked).toEqual(['archived'])
  fireEvent.click(screen.getByRole('tab', {name: 'All'}))
  expect(picked.at(-1)).toBe('all')
})
