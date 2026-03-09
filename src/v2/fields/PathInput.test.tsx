import {suite} from '@alinea/suite'
import {fireEvent, render, within} from '@testing-library/react'
import {PathInput} from './PathInput.js'

const test = suite(import.meta)

test('slugifies path values on change', () => {
  let current: unknown = ''
  const view = render(
    <PathInput
      id="path"
      label="Path"
      value=""
      options={{label: 'Path'}}
      readOnly={false}
      required={false}
      onChange={function onChange(value) {
        current = value
      }}
    />
  )
  const scope = within(view.container)

  const input = scope.getByRole('textbox', {name: 'Path'})
  fireEvent.change(input, {target: {value: 'Hello World'}})
  test.is(current, 'hello-world')
})
