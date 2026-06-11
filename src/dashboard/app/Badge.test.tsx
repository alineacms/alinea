import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {IcRoundPublic} from '../icons.js'
import {Badge} from './Badge.js'

afterEach(cleanup)

test('Badge renders label, status, appearance, and size attributes', () => {
  render(
    <Badge
      appearance="background"
      icon={IcRoundPublic}
      size="small"
      status="accent"
    >
      Shared
    </Badge>
  )

  const badge = screen.getByText('Shared').closest('[data-status]')
  expect(badge).toBeTruthy()
  expect(badge?.getAttribute('data-status')).toBe('accent')
  expect(badge?.getAttribute('data-appearance')).toBe('background')
  expect(badge?.getAttribute('data-size')).toBe('small')
})
