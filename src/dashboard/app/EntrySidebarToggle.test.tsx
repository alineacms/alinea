import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {EntrySidebarToggle} from './EntrySidebarToggle.js'

afterEach(cleanup)

test('EntrySidebarToggle requests opening the sidebar', () => {
  let nextOpen: boolean | undefined
  render(
    <EntrySidebarToggle
      isOpen={false}
      onOpenChange={isOpen => {
        nextOpen = isOpen
      }}
    />
  )

  const button = screen.getByRole('button', {name: 'Open entry sidebar'})
  expect(button.getAttribute('aria-pressed')).toBe('false')

  fireEvent.click(button)

  expect(nextOpen).toBe(true)
})

test('EntrySidebarToggle requests closing the sidebar', () => {
  let nextOpen: boolean | undefined
  render(
    <EntrySidebarToggle
      isOpen={true}
      onOpenChange={isOpen => {
        nextOpen = isOpen
      }}
    />
  )

  const button = screen.getByRole('button', {name: 'Close entry sidebar'})
  expect(button.getAttribute('aria-pressed')).toBe('true')

  fireEvent.click(button)

  expect(nextOpen).toBe(false)
})
