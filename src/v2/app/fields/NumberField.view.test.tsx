import {fireEvent} from '@testing-library/react'
import {Config} from 'alinea'
import {number} from 'alinea/field/number'
import {expect, test} from 'bun:test'
import 'alinea/v2/dom.js'
import {renderField} from 'alinea/v2/fixture/testUtils'
import {NumberFieldView} from './NumberField.view.js'

const Article = Config.document('Article', {
  fields: {
    rating: number('Rating')
  }
})

test('updates the number field value', async () => {
  const {editor, store, view} = await renderField({
    type: Article,
    render() {
      return <NumberFieldView field={Article.rating} />
    }
  })

  fireEvent.click(view.getByRole('button', {name: 'Increase Rating'}))

  expect(store.get(editor.field.rating!.value)).toBe(1)
})
