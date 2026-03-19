import {fireEvent} from '@testing-library/react'
import {Config} from 'alinea'
import {select} from 'alinea/field/select'
import {expect, test} from 'bun:test'
import 'alinea/v2/dom.js'
import {renderField} from 'alinea/v2/fixture/testUtils'
import {SelectFieldView} from './SelectField.view.js'

const Article = Config.document('Article', {
  fields: {
    status: select('Status', {
      options: {
        draft: 'Draft',
        published: 'Published'
      }
    })
  }
})

test('updates the selected value', async () => {
  const {editor, store, view} = await renderField({
    type: Article,
    render() {
      return <SelectFieldView field={Article.status} />
    }
  })

  fireEvent.click(view.getByRole('button'))
  fireEvent.click(view.getByRole('option', {name: 'Published'}))

  expect(store.get(editor.field.status!.value)).toBe('published')
})
