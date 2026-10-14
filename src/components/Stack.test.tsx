import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Stack} from './Stack.js'

afterEach(cleanup)

test('Stack exposes its layout as data attributes', () => {
  render(
    <Stack direction="row" gap={8} align="center" justify="between" wrap>
      <span>Title</span>
    </Stack>
  )
  const stack = screen.getByText('Title').parentElement!
  expect(stack.dataset.slot).toBe('stack')
  expect(stack.dataset.direction).toBe('row')
  expect(stack.dataset.align).toBe('center')
  expect(stack.dataset.justify).toBe('between')
  expect(stack.dataset.wrap).toBe('true')
  expect(stack.style.gap).toBe('8px')
})

test('Stack lays out its child with asChild', () => {
  render(
    <Stack asChild gap="1rem">
      <ul>
        <li>About</li>
      </ul>
    </Stack>
  )
  const list = screen.getByRole('list')
  expect(list.dataset.direction).toBe('column')
  expect(list.style.gap).toBe('1rem')
})
