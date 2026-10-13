import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Select, SelectItem} from './Select.js'

afterEach(cleanup)

test('Select keeps number values', () => {
  const values: Array<number | null> = []
  render(
    <Select
      label="Size"
      defaultValue={2}
      onValueChange={value => values.push(value)}
    >
      <SelectItem value={1}>Small</SelectItem>
      <SelectItem value={2}>Large</SelectItem>
    </Select>
  )
  const trigger = screen.getByRole('button', {name: /Large/})
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('option', {name: 'Small'}))
  expect(values).toEqual([1])
})
