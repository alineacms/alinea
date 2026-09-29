import {render} from '#test/react.js'
import {afterAll, beforeAll, expect, test} from 'bun:test'
import {renderToString} from 'react-dom/server'
import {Timestamp} from './Timestamp.js'

const tz = process.env.TZ
beforeAll(() => {
  process.env.TZ = 'America/Los_Angeles'
})
afterAll(() => {
  if (tz === undefined) delete process.env.TZ
  else process.env.TZ = tz
})

test('shows a date without a time on that day in any time zone', () => {
  const {container} = render(
    <Timestamp date="2026-09-23" format="date" locale="en-US" />
  )
  expect(container.textContent).toBe('Sep 23, 2026')
})

test('renders in UTC on the server and in the local time zone after', () => {
  const timestamp = (
    <Timestamp date="2026-03-15T03:30:00Z" format="date" locale="en-US" />
  )
  expect(renderToString(timestamp)).toContain('Mar 15, 2026')
  expect(render(timestamp).container.textContent).toBe('Mar 14, 2026')
})
