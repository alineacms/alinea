import {fireEvent} from '@testing-library/react'
import {Config} from 'alinea'
import {date} from 'alinea/field/date'
import {expect, test} from 'bun:test'
import 'alinea/v2/dom.js'
import {renderField} from 'alinea/v2/fixture/testUtils'
import {DateFieldView} from './DateField.view.js'

const Article = Config.document('Article', {
  fields: {
    publishDate: date('Publish date')
  }
})

test('updates the date field value', async () => {
  const {editor, store, view} = await renderField({
    type: Article,
    render() {
      return <DateFieldView field={Article.publishDate} />
    }
  })

  const input = view.container.querySelector('input[type="date"]') as
    | HTMLInputElement
    | null
  expect(input).toBeTruthy()
  input!.value = '2026-03-19'
  fireEvent.change(input!)

  expect(store.get(editor.field.publishDate!.value)).toBe('2026-03-19')
})
