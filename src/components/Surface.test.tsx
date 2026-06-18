import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {
  Surface,
  SurfaceContent,
  SurfaceHeader,
  SurfaceRow
} from './Surface.js'

afterEach(cleanup)

test('Surface renders sections and explicit depth', () => {
  render(
    <Surface depth="muted">
      <SurfaceHeader>Details</SurfaceHeader>
      <SurfaceContent>Surface body</SurfaceContent>
    </Surface>
  )

  expect(screen.getByText('Details')).toBeTruthy()
  expect(screen.getByText('Surface body')).toBeTruthy()
  expect(
    screen.getByText('Details').closest('[data-depth]')?.getAttribute(
      'data-depth'
    )
  ).toBe('muted')
})

test('Surface renders list rows with public roles', () => {
  render(
    <Surface role="list" aria-label="Sections">
      <SurfaceRow role="listitem">Hero</SurfaceRow>
      <SurfaceRow role="listitem">Quote</SurfaceRow>
    </Surface>
  )

  expect(screen.getByRole('list', {name: 'Sections'})).toBeTruthy()
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
})
