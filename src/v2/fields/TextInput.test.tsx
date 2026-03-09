import {suite} from '@alinea/suite'
import {render, within} from '@testing-library/react'
import {TextInput} from './TextInput.js'

const test = suite(import.meta)

test('renders a text field value', () => {
  const view = render(
    <TextInput
      id="title"
      label="Title"
      value="Hello"
      options={{label: 'Title'}}
      readOnly={false}
      required={false}
      onChange={function onChange() {}}
    />
  )
  const scope = within(view.container)

  const input = scope.getByRole('textbox', {name: 'Title'})
  test.is((input as HTMLInputElement).value, 'Hello')
})
