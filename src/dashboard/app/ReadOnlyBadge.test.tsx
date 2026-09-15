import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {ReadOnlyBadge} from './ReadOnlyBadge.js'

afterEach(cleanup)

test('identifies read-only access persistently', () => {
  render(<ReadOnlyBadge />)

  const badge = screen.getByLabelText('Read-only access')
  expect(badge.textContent).toBe('Read only')
  expect(badge.getAttribute('title')).toBe('You have read-only access')
})
