import {suite} from '@alinea/suite'
import {render, within} from '@testing-library/react'
import {SelectInput} from './SelectInput.js'

const test = suite(import.meta)

test('renders selected option label', () => {
  const view = render(
    <SelectInput
      id="category"
      label="Category"
      value="docs"
      options={{
        label: 'Category',
        options: {docs: 'Docs', news: 'News'}
      }}
      readOnly={false}
      required={false}
      onChange={function onChange() {}}
    />
  )
  const scope = within(view.container)

  test.is(scope.getAllByText('Docs').length > 0, true)
})
