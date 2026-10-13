import {act, cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {ComboBox, ComboBoxItem, type ComboBoxProps} from './ComboBox.js'

afterEach(cleanup)

function Products(props: Partial<ComboBoxProps<number>>) {
  return (
    <ComboBox label="Product" {...props}>
      <ComboBoxItem value={1}>Chair</ComboBoxItem>
      <ComboBoxItem value={2}>Table</ComboBoxItem>
    </ComboBox>
  )
}

function type(text: string) {
  const input = screen.getByRole('combobox')
  act(() => input.focus())
  fireEvent.change(input, {target: {value: text}})
}

test('ComboBox filters items on the typed text', () => {
  render(<Products />)
  type('cha')
  expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([
    'Chair'
  ])
})

test('ComboBox shows every item with filter={false}', () => {
  render(<Products filter={false} />)
  type('cha')
  expect(screen.getAllByRole('option')).toHaveLength(2)
})

test('ComboBox takes a custom filter', () => {
  render(<Products filter={text => text.startsWith('T')} />)
  type('x')
  expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([
    'Table'
  ])
})

test('ComboBox keeps number values', () => {
  const values: Array<number | null> = []
  render(<Products onValueChange={value => values.push(value)} />)
  type('tab')
  fireEvent.click(screen.getByRole('option', {name: 'Table'}))
  expect(values).toEqual([2])
})

test('ComboBox shows a spinner while loading', () => {
  render(<Products loading />)
  expect(screen.getByRole('progressbar', {name: 'Loading'})).toBeTruthy()
})
