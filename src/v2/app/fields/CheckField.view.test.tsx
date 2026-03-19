import {fireEvent} from '@testing-library/react'
import {Config} from 'alinea'
import {check} from 'alinea/field/check'
import {expect, test} from 'bun:test'
import 'alinea/v2/dom.js'
import {renderField} from 'alinea/v2/fixture/testUtils'
import {CheckFieldView} from './CheckField.view.js'

const Article = Config.document('Article', {
  fields: {
    published: check('Published')
  }
})

test('toggles the check field value', async () => {
  const {editor, store, view} = await renderField({
    type: Article,
    render() {
      return <CheckFieldView field={Article.published} />
    }
  })

  fireEvent.click(view.getByRole('checkbox', {name: 'Published'}))

  expect(store.get(editor.field.published!.value)).toBe(true)
})
