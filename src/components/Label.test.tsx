import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Label} from './Label.js'

afterEach(cleanup)

test('Label renders shared field badge', () => {
  render(<Label label="Title" shared />)

  expect(screen.getByText('Title')).toBeTruthy()
  expect(screen.getByText('Shared')).toBeTruthy()
})
