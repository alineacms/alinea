import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {NavigationSidebarToggle} from './NavigationSidebarToggle.js'

afterEach(cleanup)

test('NavigationSidebarToggle opens the navigation sidebar', () => {
  let nextOpen: boolean | undefined
  render(
    <NavigationSidebarToggle
      isOpen={false}
      onOpenChange={isOpen => {
        nextOpen = isOpen
      }}
    />
  )

  const button = screen.getByRole('button', {
    name: 'Open navigation sidebar'
  })
  expect(button.getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(button)
  expect(nextOpen).toBe(true)
})

test('NavigationSidebarToggle closes the navigation sidebar', () => {
  let nextOpen: boolean | undefined
  render(
    <NavigationSidebarToggle
      isOpen={true}
      onOpenChange={isOpen => {
        nextOpen = isOpen
      }}
    />
  )

  const button = screen.getByRole('button', {
    name: 'Close navigation sidebar'
  })
  expect(button.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(button)
  expect(nextOpen).toBe(false)
})
