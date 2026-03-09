import {suite} from '@alinea/suite'
import {fireEvent, render, within} from '@testing-library/react'
import {CheckInput} from './CheckInput.js'

const test = suite(import.meta)

test('calls onChange when toggled', () => {
  let current: unknown = false
  const view = render(
    <CheckInput
      id="featured"
      label="Featured"
      value={false}
      options={{label: 'Featured', description: 'Show in hero'}}
      readOnly={false}
      required={false}
      onChange={function onChange(value) {
        current = value
      }}
    />
  )
  const scope = within(view.container)

  const checkbox = scope.getByRole('checkbox', {name: 'Featured'})
  fireEvent.click(checkbox)
  test.is(current, true)
})
