import {fireEvent, render} from '@testing-library/react'
import 'alinea/v2/dom'
import {expect, test} from 'bun:test'
import {EntrySidebar} from './EntrySidebar.js'

test('switches between history and preview sidebar tabs', () => {
  const view = render(<EntrySidebar />)

  expect(view.getByText('History placeholder')).toBeTruthy()

  fireEvent.click(view.getByRole('tab', {name: 'Preview'}))

  expect(view.getByText('Preview placeholder')).toBeTruthy()
})
