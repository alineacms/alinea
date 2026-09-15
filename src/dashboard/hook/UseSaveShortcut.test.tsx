import {cleanup, render} from '#test/react.js'
import {afterEach, expect, mock, test} from 'bun:test'
import {useSaveShortcut} from './UseSaveShortcut.js'

afterEach(cleanup)

interface ShortcutProps {
  action?: () => void
  disabled?: boolean
}

function Shortcut({action, disabled = false}: ShortcutProps) {
  useSaveShortcut(action, disabled)
  return null
}

function pressSave(modifier: 'ctrl' | 'meta' = 'ctrl') {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ctrlKey: modifier === 'ctrl',
    key: 's',
    metaKey: modifier === 'meta'
  })
  document.dispatchEvent(event)
  return event
}

test('runs the current save action and prevents the browser shortcut', () => {
  const first = mock(() => undefined)
  const second = mock(() => undefined)
  const view = render(<Shortcut action={first} />)

  const firstEvent = pressSave()
  view.rerender(<Shortcut action={second} />)
  const secondEvent = pressSave('meta')

  expect(firstEvent.defaultPrevented).toBe(true)
  expect(secondEvent.defaultPrevented).toBe(true)
  expect(first).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
})

test('prevents Save Page without running disabled or missing actions', () => {
  const action = mock(() => undefined)
  const view = render(<Shortcut action={action} disabled />)

  const disabledEvent = pressSave()
  view.rerender(<Shortcut />)
  const missingEvent = pressSave()

  expect(disabledEvent.defaultPrevented).toBe(true)
  expect(missingEvent.defaultPrevented).toBe(true)
  expect(action).not.toHaveBeenCalled()
})

test('removes its keyboard handler when unmounted', () => {
  const action = mock(() => undefined)
  const view = render(<Shortcut action={action} />)
  view.unmount()

  const event = pressSave()

  expect(event.defaultPrevented).toBe(false)
  expect(action).not.toHaveBeenCalled()
})
