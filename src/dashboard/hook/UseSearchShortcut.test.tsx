import {cleanup, render} from '#test/react.js'
import {afterEach, expect, mock, test} from 'bun:test'
import {
  isSearchShortcut,
  searchShortcutLabel,
  useSearchShortcut
} from './UseSearchShortcut.js'

afterEach(cleanup)

interface ShortcutProps {
  action: () => void
  disabled?: boolean
}

function Shortcut({action, disabled}: ShortcutProps) {
  useSearchShortcut(action, disabled)
  return null
}

function press(
  init: KeyboardEventInit,
  target: EventTarget = document.body
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init
  })
  target.dispatchEvent(event)
  return event
}

test('matches ⌘K and Ctrl+K only', () => {
  const event = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init)
  expect(isSearchShortcut(event({key: 'k', metaKey: true}))).toBe(true)
  expect(isSearchShortcut(event({key: 'K', ctrlKey: true}))).toBe(true)
  expect(isSearchShortcut(event({key: 'k'}))).toBe(false)
  expect(
    isSearchShortcut(event({key: 'k', ctrlKey: true, shiftKey: true}))
  ).toBe(false)
  expect(isSearchShortcut(event({key: 'k', metaKey: true, altKey: true}))).toBe(
    false
  )
})

test('runs the action from anywhere, including text inputs', () => {
  const action = mock(() => undefined)
  render(<Shortcut action={action} />)
  const input = document.createElement('input')
  document.body.append(input)

  const fromBody = press({key: 'k', metaKey: true})
  const fromInput = press({key: 'k', ctrlKey: true}, input)
  press({key: 'k'}, input)

  expect(action).toHaveBeenCalledTimes(2)
  expect(fromBody.defaultPrevented).toBe(true)
  expect(fromInput.defaultPrevented).toBe(true)
  input.remove()
})

test('runs even when an overlay stops propagation', () => {
  const action = mock(() => undefined)
  render(<Shortcut action={action} />)
  const overlay = document.createElement('div')
  const input = document.createElement('input')
  overlay.append(input)
  document.body.append(overlay)
  overlay.addEventListener('keydown', event => event.stopPropagation())

  press({key: 'k', metaKey: true}, input)

  expect(action).toHaveBeenCalledTimes(1)
  overlay.remove()
})

test('leaves the shortcut to editable content and when disabled', () => {
  const action = mock(() => undefined)
  const view = render(<Shortcut action={action} />)
  const editor = document.createElement('div')
  editor.contentEditable = 'true'
  document.body.append(editor)

  const fromEditor = press({key: 'k', metaKey: true}, editor)
  view.rerender(<Shortcut action={action} disabled />)
  press({key: 'k', metaKey: true})

  expect(fromEditor.defaultPrevented).toBe(false)
  expect(action).not.toHaveBeenCalled()
  editor.remove()
})

test('removes its keyboard handler when unmounted', () => {
  const action = mock(() => undefined)
  const view = render(<Shortcut action={action} />)
  view.unmount()
  press({key: 'k', metaKey: true})
  expect(action).not.toHaveBeenCalled()
})

test('labels the shortcut per platform', () => {
  expect(searchShortcutLabel(true)).toBe('⌘K')
  expect(searchShortcutLabel(false)).toBe('Ctrl K')
})
