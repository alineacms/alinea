import '../dashboard/dom.js'
import {suite} from '@alinea/suite'
import {cleanup, fireEvent, render} from '@testing-library/react'
import {afterEach, expect} from 'bun:test'
import {useListData} from 'react-stately'
import {
  MultipleSelect,
  MultipleSelectItem,
  type SelectedKey
} from './MultipleSelect.js'
import {Tag} from './TagGroup.js'

const test = suite(import.meta)

afterEach(cleanup)

const fruits: Array<SelectedKey> = [
  {id: 1, name: 'Apple'},
  {id: 2, name: 'Banana'},
  {id: 3, name: 'Cherry'}
]

interface MultipleSelectHarnessProps {
  items?: Array<SelectedKey>
  initialItems?: Array<SelectedKey>
  onItemCleared?: (key: SelectedKey['id']) => void
  onItemInserted?: (key: SelectedKey['id']) => void
  renderEmptyState?: (inputValue: string) => React.ReactNode
}

function MultipleSelectHarness({
  items = fruits,
  initialItems = [],
  onItemCleared,
  onItemInserted,
  renderEmptyState
}: MultipleSelectHarnessProps) {
  const selectedItems = useListData<SelectedKey>({
    initialItems
  })

  return (
    <MultipleSelect
      items={items}
      label="Fruits"
      name="fruits"
      onItemCleared={onItemCleared}
      onItemInserted={onItemInserted}
      placeholder="Pick fruit"
      renderEmptyState={renderEmptyState}
      selectedItems={selectedItems}
      tag={item => <Tag data-shape="circle">{item.name}</Tag>}
    >
      {item => {
        return (
          <MultipleSelectItem id={item.id} textValue={item.name}>
            {item.name}
          </MultipleSelectItem>
        )
      }}
    </MultipleSelect>
  )
}

test('MultipleSelect renders selected tags and hidden form value', () => {
  const view = render(
    <MultipleSelectHarness initialItems={[fruits[0], fruits[1]]} />
  )

  view.getByRole('row', {name: 'Apple'})
  view.getByRole('row', {name: 'Banana'})
  const input = view.container.querySelector<HTMLInputElement>(
    'input[name="fruits"]'
  )
  expect(input?.value).toBe('1,2')
})

test('MultipleSelect adds selected options through the popover', async () => {
  const inserted: Array<SelectedKey['id']> = []
  const view = render(
    <MultipleSelectHarness onItemInserted={key => inserted.push(key)} />
  )

  fireEvent.click(view.getByRole('button', {name: /fruits|pick fruit/i}))
  fireEvent.click(await view.findByRole('option', {name: 'Cherry'}))

  view.getByRole('row', {name: 'Cherry'})
  const input = view.container.querySelector<HTMLInputElement>(
    'input[name="fruits"]'
  )
  expect(input?.value).toBe('3')
  expect(inserted).toEqual([3])
})

test('MultipleSelect renders the search field in the popover', async () => {
  const view = render(<MultipleSelectHarness />)

  fireEvent.click(view.getByRole('button', {name: /fruits|pick fruit/i}))

  const search = await view.findByRole('searchbox', {name: 'Search options'})
  expect(search.getAttribute('placeholder')).toBe('Search')
  expect(search.className).toContain('MultipleSelectPopover-search-input')
  expect(search.parentElement?.className).toContain(
    'MultipleSelectPopover-search-field'
  )
})

test('MultipleSelect opens when the empty field is pressed', async () => {
  const view = render(<MultipleSelectHarness />)

  fireEvent.pointerDown(view.getByRole('group', {name: 'Fruits'}))

  await view.findByRole('option', {name: 'Apple'})
})

test('MultipleSelect opens when the space around selected tags is pressed', async () => {
  const view = render(<MultipleSelectHarness initialItems={[fruits[0]]} />)

  fireEvent.pointerDown(view.getByRole('group', {name: 'Fruits'}))

  await view.findByRole('option', {name: 'Banana'})
})

test('MultipleSelect removes selected tags', () => {
  const cleared: Array<SelectedKey['id']> = []
  const view = render(
    <MultipleSelectHarness
      initialItems={[fruits[0]]}
      onItemCleared={key => cleared.push(key)}
    />
  )

  fireEvent.click(view.getByRole('button', {name: /remove apple/i}))

  expect(view.queryByRole('row', {name: 'Apple'})).toBeNull()
  const input = view.container.querySelector<HTMLInputElement>(
    'input[name="fruits"]'
  )
  expect(input?.value).toBe('')
  expect(cleared).toEqual([1])
})
