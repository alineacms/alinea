import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import type {SVGProps} from 'react'
import {TextField} from './TextField.js'

afterEach(cleanup)

test('TextField clears when a controlled value returns to undefined', () => {
  let value: string | undefined
  const onValueChange = (next: string) => {
    value = next
  }
  const view = render(
    <TextField label="Name" value={value} onValueChange={onValueChange} />
  )
  const input = screen.getByRole('textbox') as HTMLInputElement
  // A keystroke while the value is still undefined
  fireEvent.change(input, {target: {value: 'Stale'}})
  view.rerender(
    <TextField label="Name" value="Ada" onValueChange={onValueChange} />
  )
  expect(input.value).toBe('Ada')
  fireEvent.change(input, {target: {value: 'Grace'}})
  expect(value).toBe('Grace')
  view.rerender(
    <TextField label="Name" value="Grace" onValueChange={onValueChange} />
  )
  expect(input.value).toBe('Grace')
  view.rerender(
    <TextField label="Name" value={undefined} onValueChange={onValueChange} />
  )
  expect(input.value).toBe('')
})

test('TextField keeps typed text when uncontrolled', () => {
  render(<TextField label="Name" defaultValue="Ada" />)
  const input = screen.getByRole('textbox') as HTMLInputElement
  expect(input.value).toBe('Ada')
  fireEvent.change(input, {target: {value: 'Grace'}})
  expect(input.value).toBe('Grace')
})

test('TextField renders start and end icons', () => {
  function Start(props: SVGProps<SVGSVGElement>) {
    return <svg data-testid="start" {...props} />
  }
  function End(props: SVGProps<SVGSVGElement>) {
    return <svg data-testid="end" {...props} />
  }
  render(<TextField label="Name" startIcon={Start} endIcon={End} />)
  const start = screen.getByTestId('start')
  const end = screen.getByTestId('end')
  expect(start.getAttribute('data-slot')).toBe('text-field-start-icon')
  expect(end.getAttribute('data-slot')).toBe('text-field-end-icon')
  expect(start.getAttribute('aria-hidden')).toBe('true')
})
